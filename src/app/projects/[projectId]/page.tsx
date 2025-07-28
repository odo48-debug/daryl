import { ProjectView } from "@/modules/projects/ui/views/project-view";
import { getQueryClient, trpc, caller } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface Props {
    params: Promise<{
        projectId: string;
    }>
};


const Page = async ({ params }: Props) => {
    const { projectId } = await params;
    
    const queryClient = getQueryClient();
    
    // Prefetch y transformar manualmente los datos
    try {
        // Prefetch messages
        const messages = await caller.messages.getMany({ projectId });
        queryClient.setQueryData(
            [['messages', 'getMany'], { input: { projectId }, type: 'query' }],
            messages
        );
        
        // Prefetch project
        const project = await caller.projects.getOne({ id: projectId });
        queryClient.setQueryData(
            [['projects', 'getOne'], { input: { id: projectId }, type: 'query' }],
            project
        );
    } catch (error) {
        console.error("Error prefetching data:", error);
    }

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ErrorBoundary fallback={<p>Something went wrong</p>}>
                <Suspense fallback={<p>Loading...</p>}>
                    <ProjectView projectId={projectId} />
                </Suspense>
            </ErrorBoundary>
        </HydrationBoundary>
    );
};

export default Page;
