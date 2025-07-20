
import { getQueryClient, trpc, caller } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Client } from "./client";
import { Suspense } from "react";

const Page = async () => {
  const queryClient = getQueryClient();
  
  // Usar el caller para ejecutar el procedimiento directamente
  const result = await caller.createAI({
    text: "PREFETCH"
  });
  
  // Prefetch la consulta con los datos ya obtenidos
  await queryClient.prefetchQuery({
    queryKey: ["createAI", { input: { text: "PREFETCH" }, type: "query" }],
    queryFn: () => result
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<p>Loading...</p>}>
         <Client />
        </Suspense>
      </HydrationBoundary>
    );
}

export default Page
