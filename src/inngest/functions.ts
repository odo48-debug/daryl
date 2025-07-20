import { createAgent, openai } from '@inngest/agent-kit';
import { inngest } from "./client";
import { getSandbox } from "./utils";
import { Sandbox } from "@e2b/code-interpreter";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("daryl-nextjs-test2");
      return sandbox.sandboxId;
    })
      
    
    // Create a new agent with a system prompt (you can add optional tools, too) - VER MINUTO 2:07:15 PARA CAMBIAR DE MODELO
    const codeAgent = createAgent({
        name: "codeAgent",
        system: "You are an expert next.js developer. You write readable, maintainable code.You write simple NextDataPathnameNormalizer.js and React snippets.",
        model: openai({ model: "gpt-4o" }),
      });
    
    // Run the agent
    const { output } = await codeAgent.run(
        `Write the following snippet: ${event.data.value}`,
    );

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    })

    return { output, sandboxUrl };
  },
);