import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";

export const messagesRouter = createTRPCRouter({
    // Procedimiento de prueba simple
    test: baseProcedure
        .query(() => {
            console.log("Messages test procedure called");
            return { message: "Messages test successful", timestamp: new Date() };
        }),
    
    getMany: baseProcedure
    .input(
        z.object({
            projectId: z.string().min(1, { message: "Project ID is required"}),
        }),
    )
    .query(async ({ input }) => {
         console.log("getMany called with input:", input);
         
         const messages = await prisma.message.findMany({
            where: {
                projectId: input.projectId,
            },
            include: {
                fragment: true
            },
            orderBy: {
                updatedAt: "asc",
            },
         });

         console.log("Raw messages from database:", messages);
         console.log("Messages count:", messages.length);
         
         // Serializar manualmente los objetos para evitar problemas con las fechas
         const serializedMessages = messages.map(message => ({
            ...message,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString(),
         }));
         
         console.log("Serialized messages:", serializedMessages);
         return serializedMessages;
    }),
    
    create: baseProcedure
    .input(
        z.object({
            value: z.string()
              .min(1, { message: "Value is required"})
              .max(10000, { message: "Value is too long"}),
            projectId: z.string().min(1, { message: "Project ID is required"}),
        })
    )
    .mutation(async ({ input }) => {
        const createdMessage = await prisma.message.create({
            data: {
                projectId: input.projectId,
                content: input.value,
                role: "USER",
                type: "RESULT",
            },
        });
        
        await inngest.send({
            name: "code-agent/run",
            data: {
                value: input.value,
                projectId: input.projectId,
            },
        });
        
        return createdMessage;
    })
})