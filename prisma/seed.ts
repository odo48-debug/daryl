import { PrismaClient, Prisma } from "../src/generated/prisma";

const prisma = new PrismaClient();

// Datos de ejemplo para proyectos
const projectData: Prisma.ProjectCreateInput[] = [
  {
    name: "Proyecto de Ejemplo",
    userId: "user_123", // ID de usuario de ejemplo
    messages: {
      create: [
        {
          content: "¿Puedes crear una aplicación web simple?",
          role: "USER",
          type: "RESULT",
        },
        {
          content: "Claro, he creado una aplicación web simple para ti.",
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: "https://example.com/sandbox",
              title: "Web App",
              files: JSON.stringify({
                "index.html": "<html><body><h1>Hola Mundo</h1></body></html>"
              })
            }
          }
        },
      ],
    },
  },
];

// Datos de ejemplo para Usage
const usageData: Prisma.UsageCreateInput[] = [
  {
    key: "user_123",
    points: 5,
    expire: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días desde ahora
  },
];

export async function main() {
  console.log(`Start seeding ...`);
  
  // Crear proyectos de ejemplo
  for (const p of projectData) {
    const project = await prisma.project.create({
      data: p,
      include: {
        messages: true,
      },
    });
    console.log(`Created project with id: ${project.id}`);
  }
  
  // Crear registros de uso
  for (const u of usageData) {
    const usage = await prisma.usage.create({
      data: u,
    });
    console.log(`Created usage record for key: ${usage.key}`);
  }
  
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });