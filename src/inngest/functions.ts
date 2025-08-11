import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, openai, anthropic, createTool, createNetwork, Tool, Message, createState } from '@inngest/agent-kit';
import { inngest } from "./client";
import { PROMPT, FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT, ANALYSIS_PROMPT } from "@/prompt";


import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "./types";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}


export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("manim-cli");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      
      // Iniciar un servidor HTTP simple en el puerto 3000 para satisfacer la verificación del sandbox
      // Usamos nohup para que el proceso continúe incluso después de que se cierre la shell
      // y lo enviamos al background con & para no bloquear la ejecución
      try {
        sandbox.commands.run("nohup python3 -c \"import http.server; import socketserver; handler = http.server.SimpleHTTPRequestHandler; socketserver.TCPServer(('', 3000), handler).serve_forever()\" > /dev/null 2>&1 &", {
          timeoutMs: 5000, // 5 segundos de timeout
          onStdout: (data) => console.log("HTTP Server stdout:", data),
          onStderr: (data) => console.log("HTTP Server stderr:", data)
        });
        // No esperamos a que termine el comando, ya que se ejecuta en segundo plano
      } catch (error) {
        console.log("Error al iniciar el servidor HTTP en puerto 3000:", error);
        // Continuamos incluso si hay un error al iniciar el servidor
      }
      
      // Iniciar un servidor HTTP adicional en el puerto 4999
      try {
        sandbox.commands.run("nohup python3 -c \"import http.server; import socketserver; handler = http.server.SimpleHTTPRequestHandler; socketserver.TCPServer(('', 4999), handler).serve_forever()\" > /dev/null 2>&1 &", {
          timeoutMs: 5000, // 5 segundos de timeout
          onStdout: (data) => console.log("HTTP Server 4999 stdout:", data),
          onStderr: (data) => console.log("HTTP Server 4999 stderr:", data)
        });
        // No esperamos a que termine el comando, ya que se ejecuta en segundo plano
      } catch (error) {
        console.log("Error al iniciar el servidor HTTP en puerto 4999:", error);
        // Continuamos incluso si hay un error al iniciar el servidor
      }
      
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc", // TODO: change to 'asc' if AI is not able to read the messages
        },
        take: 10,
      });

      for (const message of messages) {
        formattedMessages.push({
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
          type: "text",
        });
      }

      return formattedMessages.reverse();
    });

    const state = createState<AgentState>({
      summary: "",
      files: {},
    },
    {
       messages: previousMessages,
    },
  );
    
    // AGENTE ANALYST
const analystAgent = createAgent<AgentState>({
  name: "analystAgent",
  description: "An expert analyst that understands user prompts and gives precise coding tasks",
  system: ANALYSIS_PROMPT,
  model: anthropic({
    model: "claude-sonnet-4-20250514",
    defaultParameters: {
      temperature: 0.2,
      max_tokens: 1000,
    },
  }),
  lifecycle: {
    onResponse: async ({ result, network }) => {
      const lastAssistantMessageText = lastAssistantTextMessageContent(result);

      if (lastAssistantMessageText && network) {
        if (lastAssistantMessageText.includes("<task_summary>")) {
          network.state.data.summary = lastAssistantMessageText;
        }
      }

      return result;
    },
  },
});

// AGENTE CODE
const codeAgent = createAgent<AgentState>({
  name: "codeAgent",
  description: "An expert coding agent",
  system: PROMPT,
  model: openai({ 
    model: "gpt-4.1",
    defaultParameters: {
      temperature: 0.1,
    }
  }),
  tools: [
    createTool({
      name: "terminal",
      description: "Use the terminal to run commands",
      parameters: z.object({
        command: z.string(),
      }),
      handler: async ({ command }, { step }) => {
        return await step?.run("terminal", async () => {
          const buffers = { stdout: "", stderr: "" };
          try {
            const sandbox = await getSandbox(sandboxId);
            const result = await sandbox.commands.run(command, {
              onStdout: (data: string) => {
                buffers.stdout += data;
              },
              onStderr: (data: string) => {
                buffers.stderr += data;
              }
            });
            return result.stdout;
          } catch (e) {
            console.error(
              `Command failed: ${e}\nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
            );
            return `Command failed: ${e}\nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`;
          }
        });
      }
    }),
    createTool({
      name: "createOrUpdateFiles",
      description: "Create or update files in the sandbox",
      parameters: z.object({
        files: z.array(
          z.object({
            path: z.string(),
            content: z.string(),
          }),
        ),
      }),
      handler: async ({ files }, { step, network }) => {
        const newFiles = await step?.run("createOrUpdateFiles", async () => {
          try {
            const updatedFiles = network.state.data.files || {};
            const sandbox = await getSandbox(sandboxId);
            for (const file of files) {
              await sandbox.files.write(file.path, file.content);
              updatedFiles[file.path] = file.content;
            }
            return updatedFiles;
          } catch (e) {
            return "Error: " + e;
          }
        });

        if (typeof newFiles === "object") {
          network.state.data.files = newFiles;
        }
      }
    }),
    createTool({
      name: "readFiles",
      description: "Read files from the sandbox",
      parameters: z.object({
        files: z.array(z.string()),
      }),
      handler: async ({ files }, { step }) => {
        return await step?.run("readFiles", async () => {
          try {
            const sandbox = await getSandbox(sandboxId);
            interface FileContent {
              path: string;
              content: string;
            }
            const contents: FileContent[] = [];
            for (const file of files) {
              const content = await sandbox.files.read(file);
              contents.push({ path: file, content });
            }
            return JSON.stringify(contents);
          } catch (e) {
            return "Error: " + e;
          }
        });
      },
    })
  ],
  lifecycle: {
    onResponse: async ({ result, network }) => {
      const lastAssistantMessageText = lastAssistantTextMessageContent(result);

      if (lastAssistantMessageText && network) {
        if (lastAssistantMessageText.includes("<task_summary>")) {
          network.state.data.summary = lastAssistantMessageText;
        }
      }

      return result;
    },
  },
});

// NETWORK
const network = createNetwork<AgentState>({
  name: "coding-agent-network",
  agents: [analystAgent, codeAgent], // orden importante: analyst va primero
  maxIter: 5,
  defaultState: state,
  router: async ({ network }) => {
    const summary = network.state.data.summary;

    // Si aún no hay summary, ejecuta el analystAgent
    if (!summary) {
      return analystAgent;
    }

    // Una vez haya summary, pasa al codeAgent
    return codeAgent;
  },
});


    
    const result = await network.run(event.data.value, {
      state,
    });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "Generates a title for a code fragment",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: "gpt-4o-mini",
        defaultParameters: {
          temperature: 0.1,
        }
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "Generates a response for the user",
      system: RESPONSE_PROMPT,
      model: openai({
        model: "gpt-4o-mini",
        defaultParameters: {
          temperature: 0.1,
        }
      }),
    });

    const { 
      output: fragmentTitleOutput 
    } = await fragmentTitleGenerator.run(result.state.data.summary);
    const { 
      output: responseOutput 
    } = await responseGenerator.run(result.state.data.summary);

    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") {
        return "Fragment";
      }
      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt) => txt).join(""); 
      } else {
        return fragmentTitleOutput[0].content;
      }
    };
    
    const generateResponse = () => {
        if (responseOutput[0].type !== "text") {
          return "Here you go";
        }
        if (Array.isArray(responseOutput[0].content)) {
          return responseOutput[0].content.map((txt) => txt).join(""); 
        } else {
          return responseOutput[0].content;
        }
    }

    const isError =
      !result.state.data.summary || 
      Object.keys(result.state.data.files || {}).length === 0;
      

    // Obtener la URL del video (incluye obtener la URL base del sandbox y buscar el video)
    const sandboxUrl = await step.run("get-video-url", async () => {
      // Primero obtener la URL base del sandbox
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      const baseUrl = `https://${host}`;
      
      // Ahora buscar el video y construir la URL completa
      try {
        // Verificar que el directorio output existe
        await sandbox.commands.run("mkdir -p output");
        
        // Intentar diferentes métodos para encontrar la URL del video
        
        // 1. Buscar en los logs del sandbox por la URL del video
        try {
          const logOutput = await sandbox.commands.run("cat /home/user/nohup.out 2>/dev/null || echo ''");
          console.log("Contenido de los logs:", logOutput);
          
          // Buscar la línea que comienza con VIDEO_URL:
          if (logOutput && logOutput.stdout) {
            const videoUrlMatch = logOutput.stdout.match(/VIDEO_URL:([^\n]+)/);
            if (videoUrlMatch && videoUrlMatch[1]) {
              const videoPath = videoUrlMatch[1].trim();
              // Construir la URL completa asegurando que tenga el protocolo https:
              if (videoPath.startsWith('://')) {
                return `https${videoPath}`;
              } else {
                return `${baseUrl}${videoPath}`;
              }
              console.log(`URL del video encontrada en logs: ${baseUrl}${videoPath}`);
            }
            
            // También buscar VIDEO_FILENAME: como respaldo
            const filenameMatch = logOutput.stdout.match(/VIDEO_FILENAME:([^\n]+)/);
            if (filenameMatch && filenameMatch[1]) {
              const filename = filenameMatch[1].trim();
              const url = `${baseUrl}/output/${filename}`;
              console.log(`URL del video construida desde filename: ${url}`);
              return url;
            }
          }
        } catch (error) {
          console.error("Error al buscar en los logs:", error);
          // Continuar con otros métodos
        }
        
        // 2. Si no se encuentra en los logs, buscar archivos MP4 en el directorio output
        try {
          // Primero listar todos los archivos en output para depuración
          const listOutput = await sandbox.commands.run("ls -la output 2>/dev/null || echo 'No hay archivos'");
          console.log("Archivos en directorio output:", listOutput.stdout);
          
          // Buscar archivos MP4 en el directorio output
          const filesOutput = await sandbox.commands.run("find output -name '*.mp4' | sort -r | head -n 1 2>/dev/null || echo ''");
          console.log("Resultado de búsqueda de MP4:", filesOutput);
          
          if (filesOutput && filesOutput.stdout && filesOutput.stdout.trim()) {
            // Extraer el nombre del archivo
            const videoFilename = filesOutput.stdout.trim().replace(/^output\//, '');
            
            if (videoFilename) {
              // Construir la URL completa
              const url = `${baseUrl}/output/${videoFilename}`;
              console.log(`URL del video encontrado: ${url}`);
              return url;
            }
          }
          
          // 3. Intentar con una búsqueda más amplia
          const allVideos = await sandbox.commands.run("find . -name '*.mp4' 2>/dev/null || echo ''");
          console.log("Todos los videos encontrados en el sistema:", allVideos.stdout);
          
          if (allVideos && allVideos.stdout && allVideos.stdout.trim()) {
            // Buscar primero en output
            const lines = allVideos.stdout.trim().split('\n');
            const outputVideo = lines.find(line => line.startsWith('./output/'));
            
            if (outputVideo) {
              const videoPath = outputVideo.substring(1); // Quitar el punto inicial
              // Asegurar que la URL tenga el protocolo https:
              if (videoPath.startsWith('://')) {
                const url = `https${videoPath}`;
                console.log(`URL del video encontrado en búsqueda amplia: ${url}`);
                return url;
              } else {
                const url = `${baseUrl}${videoPath}`;
                console.log(`URL del video encontrado en búsqueda amplia: ${url}`);
                return url;
              }
            } else if (lines.length > 0) {
              // Si no hay video en output pero hay en otro lugar, intentar copiarlo a output
              const firstVideo = lines[0];
              const videoName = firstVideo.split('/').pop();
              if (videoName) {
                await sandbox.commands.run(`mkdir -p output && cp ${firstVideo} output/${videoName} 2>/dev/null || echo 'Error al copiar'`);
                const url = `${baseUrl}/output/${videoName}`;
                console.log(`Video copiado a output, URL: ${url}`);
                return url;
              }
            }
          }
        } catch (error) {
          console.error("Error al buscar archivos MP4:", error);
          // Continuar con el flujo
        }
        
        // Si no se encontró ningún video, devolver la URL base del sandbox
        console.log(`No se encontró ningún video. Usando URL base del sandbox: ${baseUrl}`);
        return baseUrl;
      } catch (error) {
        console.error("Error al extraer la URL del video:", error);
        return baseUrl; // Devolver la URL base en caso de error
      }
    });


    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          }
        });
      }
      
      // Intentar descargar el video si la URL termina en .mp4
      let videoData = null;
      let videoMimeType = null;
      
      if (sandboxUrl && sandboxUrl.toLowerCase().endsWith('.mp4')) {
        try {
          console.log("Descargando video del sandbox desde URL:", sandboxUrl);
          
          // Obtener el contenido del video usando fetch con timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
          
          const response = await fetch(sandboxUrl, { 
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            // Convertir la respuesta a un ArrayBuffer
            const videoBuffer = await response.arrayBuffer();
            const contentType = response.headers.get("content-type") || "video/mp4";
            
            // Convertir el ArrayBuffer a base64 para almacenarlo como string en la base de datos
            const uint8Array = new Uint8Array(videoBuffer);
            const videoBase64 = Buffer.from(uint8Array).toString('base64');
            
            console.log(`Video descargado: ${videoBuffer.byteLength} bytes, tipo: ${contentType}`);
            
            // Añadir el video a los archivos como un campo especial
            // Necesitamos asegurarnos de que todos los valores sean strings
            result.state.data.files = {
              ...result.state.data.files,
              "__video_data__": videoBase64,
              "__video_mime_type__": contentType
            };
          } else {
            console.warn(`Error al descargar el video: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error("Error al descargar el video:", error);
        }
      }
      
      // Crear el mensaje con el fragmento
      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: result.state.data.files,
            },
          },
        },
      });
    });

    return { 
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  },
);