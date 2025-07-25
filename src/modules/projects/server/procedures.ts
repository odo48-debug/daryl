import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { generateSlug } from "random-word-slugs";

export const projectsRouter = createTRPCRouter({
    // Procedimiento de prueba simple
    test: baseProcedure
        .query(() => {
            console.log("Test procedure called");
            return { message: "Test successful", timestamp: new Date() };
        }),
    
    getOne: baseProcedure
       .input(z.object({
          id: z.string().min(1, { message: "Project ID is required" }), 
        }))
        .query(async ({ input }) => {
         console.log("getOne called with input:", input);
         
         const existingProject = await prisma.project.findUnique({
            where: {
                id: input.id,
            },
         });

         console.log("Raw project from database:", existingProject);

         if (!existingProject) {
            console.log("Project not found, throwing error");
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

    getMany: baseProcedure
      .query(async () => {
        const projects = await prisma.project.findMany({
          orderBy: {
            createdAt: "desc",
          },
        });
        return projects;
    }),
    create: baseProcedure
      .input(
        z.object({
            value: z.string()
              .min(1, { message: "Value is required"})
              .max(10000, { message: "Value is too long"}),
        })
    )
    .mutation(async ({ input }) => {
        const createdProject = await prisma.project.create({
            data: {
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
    })
})