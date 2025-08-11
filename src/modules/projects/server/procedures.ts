import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { getSandbox } from "@/inngest/utils";
import { generateSlug } from "random-word-slugs";
import { consumeCredits } from "@/lib/usage";
import { put } from "@vercel/blob";

export const projectsRouter = createTRPCRouter({
    
    getOne: protectedProcedure
       .input(z.object({
          id: z.string().min(1, { message: "Project ID is required" }), 
        }))
        .query(async ({ input, ctx }) => {
         
         const existingProject = await prisma.project.findUnique({
            where: {
                id: input.id,
                userId: ctx.auth.userId,
            },
         });

         if (!existingProject) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Project not found"})
         }
         
         // Serializar manualmente el objeto para evitar problemas con las fechas
         const serializedProject = {
            ...existingProject,
            createdAt: existingProject.createdAt.toISOString(),
            updatedAt: existingProject.updatedAt.toISOString(),
         };
         
         console.log("Returning serialized project:", serializedProject);
         return serializedProject;
    }),

    getMany: protectedProcedure
      .query(async ({ ctx }) => {
        const projects = await prisma.project.findMany({
            where: {
                userId: ctx.auth.userId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return projects;
    }),
    create: protectedProcedure
      .input(
        z.object({
            value: z.string()
              .min(1, { message: "Value is required"})
              .max(10000, { message: "Value is too long"}),
        })
    )
    .mutation(async ({ input, ctx }) => {

        try {
            await consumeCredits();
        } catch (error) {
          if (error instanceof Error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Something went wrong" });
          } else {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You have run out of credits" });
          }
        }
        
        const createdProject = await prisma.project.create({
            data: {
                userId: ctx.auth.userId,
                name: generateSlug(2, { 
                    format: "kebab"
                }),
                messages: {
                    create: {
                        content: input.value,
                        role: "USER",
                        type: "RESULT",
                    },
                },
            },
        });
        
        await inngest.send({
            name: "code-agent/run",
            data: {
                value: input.value,
                projectId: createdProject.id,
            },
        });
        
        return createdProject;
    }),

    update: protectedProcedure
      .input(
        z.object({
            id: z.string().min(1, { message: "Project ID is required" }),
            name: z.string().min(1, { message: "Project name is required" }),
        })
    )
    .mutation(async ({ input, ctx }) => {
        // Verificar que el proyecto existe y pertenece al usuario
        const existingProject = await prisma.project.findUnique({
            where: {
                id: input.id,
                userId: ctx.auth.userId,
            },
        });

        if (!existingProject) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        // Actualizar el nombre del proyecto
        const updatedProject = await prisma.project.update({
            where: {
                id: input.id,
            },
            data: {
                name: input.name,
            },
        });

        return updatedProject;
    }),
    
    delete: protectedProcedure
      .input(
        z.object({
            id: z.string().min(1, { message: "Project ID is required" }),
        })
    )
    .mutation(async ({ input, ctx }) => {
        // Verificar que el proyecto existe y pertenece al usuario
        const existingProject = await prisma.project.findUnique({
            where: {
                id: input.id,
                userId: ctx.auth.userId,
            },
        });

        if (!existingProject) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        // Delete the project
        const deletedProject = await prisma.project.delete({
            where: {
                id: input.id,
            },
        });

        return deletedProject;
    }),
    
    executeCode: protectedProcedure
      .input(
        z.object({
            projectId: z.string().min(1, { message: "Project ID is required" }),
            files: z.record(z.string()),
            mainFile: z.string().optional(),
        })
    )
    .mutation(async ({ input, ctx }) => {
        // Verificar que el proyecto existe y pertenece al usuario
        const existingProject = await prisma.project.findUnique({
            where: {
                id: input.projectId,
                userId: ctx.auth.userId,
            },
        });

        if (!existingProject) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        
        try {
            // Obtener el último fragmento del proyecto
            const lastFragment = await prisma.fragment.findFirst({
                where: {
                    message: {
                        projectId: input.projectId
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            
            if (!lastFragment) {
                throw new TRPCError({ 
                    code: "BAD_REQUEST", 
                    message: "No valid fragment found to execute code" 
                });
            }
            
            // Get the sandboxId from the sandbox URL
            // The URL format is: https://3000-[sandbox-code].e2b.app/output/filename.mp4
            const sandboxIdMatch = lastFragment.sandboxUrl.match(/https:\/\/3000-([a-z0-9]+)\.e2b\.app/i);
            const sandboxId = sandboxIdMatch ? sandboxIdMatch[1] : null;
            
            console.log("URL del sandbox:", lastFragment.sandboxUrl);
            console.log("ID del sandbox extraído:", sandboxId);
            
            if (!sandboxId) {
                throw new TRPCError({ 
                    code: "BAD_REQUEST", 
                    message: "No sandbox ID found in URL" 
                });
            }
            
            // Determine the main file to execute
            const mainFile = input.mainFile || Object.keys(input.files).find(file => 
                file.endsWith(".py") && !file.startsWith("_")
            ) || Object.keys(input.files)[0];
            
            if (!mainFile) {
                throw new TRPCError({ 
                    code: "BAD_REQUEST", 
                    message: "File not found" 
                });
            }
            
            // Get the sandbox
            const sandbox = await getSandbox(sandboxId);
            
            // Limpiar archivos existentes en el sandbox para evitar conflictos
            try {
                // Listar archivos en el directorio scripts
                const existingFiles = await sandbox.commands.run("find scripts -type f -name '*.py'");
                if (existingFiles.stdout.trim()) {
                    // Eliminar archivos existentes para evitar conflictos
                    await sandbox.commands.run("rm -f scripts/*.py");
                    console.log("Existing Python files deleted from the sandbox");
                }
            } catch (error) {
                console.warn("Error cleaning up existing files:", error);
                // Continue even if the cleanup fails
            }
            
            // Create or update the files in the sandbox with the modified code
            console.log("Updating files in the sandbox with the modified code:");
            for (const [path, content] of Object.entries(input.files)) {
                console.log(`- Writing file: ${path}`);
                await sandbox.files.write(path, content);
            }
            
            // Execute the code
            console.log(`Executing: python ${mainFile}`);
            const result = await sandbox.commands.run(`python ${mainFile}`);
            
            console.log("Command output:", result.stdout);
            console.log("Command errors:", result.stderr);
            
            // Search for the video URL in the output
            const outputLines = result.stdout.split("\n");
            let videoUrl = "";
            let videoFilename = "";
            
            // Search for VIDEO_URL and VIDEO_FILENAME in the output
            for (const line of outputLines) {
                if (line.startsWith("VIDEO_URL:")) {
                    videoUrl = line.replace("VIDEO_URL:", "").trim();
                    console.log("URL of the video found:", videoUrl);
                }
                if (line.startsWith("VIDEO_FILENAME:")) {
                    videoFilename = line.replace("VIDEO_FILENAME:", "").trim();
                    console.log("Video filename found:", videoFilename);
                }
            }
            
            // If no URL was found but the filename was, construct the URL
            if (!videoUrl && videoFilename) {
                videoUrl = `/output/${videoFilename}`;
                console.log("URL of the video constructed from the filename:", videoUrl);
            }
            
            // If we don't have a URL, look for MP4 or WebM files in the output folder
            if (!videoUrl) {
                try {
                    const outputFiles = await sandbox.commands.run("ls -la output");
                    console.log("Files in the output folder:", outputFiles.stdout);
                    
                    // Search for video files (MP4 or WebM) in the output
                    const videoMatch = outputFiles.stdout.match(/([\w-]+\.(mp4|webm))/i);
                    if (videoMatch && videoMatch[1]) {
                        videoUrl = `/output/${videoMatch[1]}`;
                        console.log("URL of the video found in the list of files:", videoUrl);
                        
                        // Store the video format for later use
                        const videoFormat = videoMatch[1].toLowerCase().endsWith('webm') ? 'webm' : 'mp4';
                        console.log("Detected video format:", videoFormat);
                    }
                } catch (error) {
                    console.error("Error listing files in the output folder:", error);
                }
            }
            
            // Update the fragment with the new URL if found
            if (videoUrl) {
                // Asegurarse de que la URL del video comienza con /
                if (!videoUrl.startsWith("/")) {
                    videoUrl = `/${videoUrl}`;
                }
                
                // Extraer la URL base del sandbox
                let baseUrl = "";
                if (lastFragment.sandboxUrl.includes("/output/")) {
                    baseUrl = lastFragment.sandboxUrl.split("/output/")[0];
                } else {
                    // Si no hay /output/ en la URL, usar la URL completa hasta el último /
                    const lastSlashIndex = lastFragment.sandboxUrl.lastIndexOf("/");
                    if (lastSlashIndex > 0) {
                        baseUrl = lastFragment.sandboxUrl.substring(0, lastSlashIndex);
                    } else {
                        baseUrl = lastFragment.sandboxUrl;
                    }
                }
                
                // Construir la nueva URL del sandbox
                const newSandboxUrl = `${baseUrl}${videoUrl}`;
                console.log("New sandbox URL:", newSandboxUrl);
                
                try {
                    console.log("[VIDEO PROCESSING] Starting video download from sandbox URL:", newSandboxUrl);
                    
                    // Get the video content using fetch with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
                    
                    const response = await fetch(newSandboxUrl, { 
                        signal: controller.signal,
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    console.log("[VIDEO PROCESSING] Fetch response status:", response.status, response.statusText);
                    
                    if (!response.ok) {
                        throw new Error(`Error downloading the video: ${response.status} ${response.statusText}`);
                    }
                    
                    // Verify the content type
                    const contentType = response.headers.get("content-type");
                    console.log("[VIDEO PROCESSING] Content type received:", contentType);
                    
                    // Determine the correct MIME type based on the URL and content type
                    let videoMimeType = "video/mp4"; // Default
                    
                    if (contentType && contentType.includes('video')) {
                        videoMimeType = contentType;
                    } else if (newSandboxUrl.toLowerCase().endsWith('.webm')) {
                        videoMimeType = "video/webm";
                    } else if (newSandboxUrl.toLowerCase().endsWith('.mp4')) {
                        videoMimeType = "video/mp4";
                    }
                    
                    console.log("[VIDEO PROCESSING] Using MIME type:", videoMimeType);
                    
                    // Get the video as a blob
                    console.log("[VIDEO PROCESSING] Converting response to blob...");
                    const videoBlob = await response.blob();
                    console.log("[VIDEO PROCESSING] Video blob size:", videoBlob.size, "bytes");
                    
                    // Generate a unique filename for the video
                    const fileExtension = videoMimeType === "video/webm" ? "webm" : "mp4";
                    const filename = `${lastFragment.id}-${Date.now()}.${fileExtension}`;
                    
                    console.log("[VIDEO PROCESSING] Uploading video to Blob Storage with filename:", filename);
                    console.log("[VIDEO PROCESSING] BLOB_READ_WRITE_TOKEN available:", !!process.env.BLOB_READ_WRITE_TOKEN);
                    
                    try {
                        console.log("[BLOB STORAGE] Starting upload to Vercel Blob Storage...");
                        console.log("[BLOB STORAGE] Upload parameters:", {
                            filename,
                            blobSize: videoBlob.size,
                            contentType: videoMimeType,
                            access: 'public'
                        });
                        
                        // Upload the video to Vercel Blob Storage
                        const { url } = await put(filename, videoBlob, {
                          access: 'public',
                          contentType: videoMimeType,
                        });
                        
                        console.log(`[BLOB STORAGE] ✅ Video uploaded successfully to Blob Storage: ${url}`);
                        
                        console.log("[DATABASE] Updating fragment in the database with ID:", lastFragment.id);
                        
                        // Primero, obtener el fragmento actual para preservar los datos existentes
                        const currentFragment = await prisma.fragment.findUnique({
                            where: {
                                id: lastFragment.id
                            },
                            select: {
                                files: true
                            }
                        });
                        
                        // Extraer los archivos actuales como un objeto
                        const currentFiles = currentFragment?.files as Record<string, any> || {};
                        
                        // Crear un nuevo objeto fusionando los archivos actuales y los nuevos archivos
                        const updatedFiles = {
                            ...currentFiles,      // Mantener todos los datos existentes
                            ...input.files,       // Añadir/actualizar los archivos modificados
                            // Guardar la URL del video en lugar del video en sí
                            "__video_url__": url,
                            "__video_mime_type__": videoMimeType
                        };
                        
                        console.log("[DATABASE] Video URL and MIME type being saved:", {
                            url,
                            mimeType: videoMimeType
                        });
                        
                        // Update the fragment in the database with the merged files
                        await prisma.fragment.update({
                            where: {
                                id: lastFragment.id
                            },
                            data: {
                                sandboxUrl: newSandboxUrl,
                                files: updatedFiles
                            }
                        });
                        
                        console.log("[DATABASE] ✅ Video URL saved successfully in the database");
                        
                        return {
                            success: true,
                            sandboxUrl: newSandboxUrl,
                            message: "Code executed correctly and video saved to Blob Storage"
                        };
                    } catch (blobError: unknown) {
                        console.error("[BLOB STORAGE] ❌ Error uploading to Blob Storage:", blobError);
                        if (blobError instanceof Error) {
                            console.error("[BLOB STORAGE] Error details:", {
                                name: blobError.name,
                                message: blobError.message,
                                stack: blobError.stack
                            });
                        }
                        const errorMessage = blobError instanceof Error ? blobError.message : 'Unknown error';
                        throw new Error(`Error uploading to Blob Storage: ${errorMessage}`);
                    }
                } catch (error) {
                    console.error("[VIDEO PROCESSING] ❌ Error processing or saving the video:", error);
                    if (error instanceof Error) {
                        console.error("[VIDEO PROCESSING] Error details:", {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        });
                    }
                    
                    // Si hay un error al descargar el video, actualizar solo la URL y los archivos
                    try {
                        await prisma.fragment.update({
                            where: {
                                id: lastFragment.id
                            },
                            data: {
                                sandboxUrl: newSandboxUrl,
                                files: input.files
                            }
                        });
                        
                        console.log("Fragment updated without video");
                    } catch (dbError) {
                        console.error("Error additional updating the fragment:", dbError);
                    }
                    
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return {
                        success: true,
                        sandboxUrl: newSandboxUrl,
                        message: `Code executed correctly, but the video could not be saved: ${errorMessage}`
                    };
                }
            }
            
            return {
                success: true,
                sandboxUrl: lastFragment.sandboxUrl,
                message: "Code executed, but no new video was generated",
                output: result.stdout
            };
            
        } catch (error) {
            console.error("Error executing the code:", error);
            throw new TRPCError({ 
                code: "INTERNAL_SERVER_ERROR", 
                message: error instanceof Error ? error.message : "Error executing the code" 
            });
        }
    })
})