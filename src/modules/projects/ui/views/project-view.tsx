"use client";

import { Suspense, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientErrorLike } from "@trpc/client";
import { useAuth } from "@clerk/nextjs";
import { EyeIcon, CodeIcon } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";

import { Fragment } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { FileExplorer } from "@/components/file-explorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { toast } from "sonner";

import { FragmentWeb } from "../components/fragment-web";
import { ProjectHeader } from "../components/project-header";
import { MessagesContainer } from "../components/messages-container";
import { UserControl } from "@/components/user-control";

import Link from "next/link";
import { CrownIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";


interface Props {
    projectId: string;
}

export const ProjectView = ({ projectId }: Props) => {
  const { hasPro, canEditCode } = useSubscription();
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Obtener el cliente TRPC
  const trpc = useTRPC();
  
  // Obtener la mutación para ejecutar el código
  const executeCodeMutation = useMutation(trpc.projects.executeCode.mutationOptions({
    onSuccess: (data: { sandboxUrl: string; message: string; success: boolean; output?: string }) => {
      // Actualizar la URL del sandbox en el fragmento activo
      if (activeFragment) {
        setActiveFragment({
          ...activeFragment,
          sandboxUrl: data.sandboxUrl
        });
      }
      
      // Cambiar a la pestaña de vista previa
      setTabState("preview");
      
      // Mostrar notificación de éxito
      toast.success(data.message);
    },
    onError: (error: TRPCClientErrorLike<any>) => {
      toast.error(`Error al ejecutar el código: ${error.message}`);
    },
    onSettled: () => {
      setIsExecuting(false);
    }
  }));
  // Función para manejar los cambios en los archivos
  const handleFileChange = (path: string, content: string) => {
    if (!activeFragment || !activeFragment.files) return;
    
    // Verificar si el usuario tiene permiso para editar código
    if (!canEditCode()) {
      toast.error("La edición de código requiere plan Pro. Por favor, actualiza tu plan.");
      return;
    }
    
    // Crear una copia del fragmento activo con los archivos actualizados
    const updatedFragment = {
      ...activeFragment,
      files: {
        ...(activeFragment.files as { [path: string]: string }),
        [path]: content
      }
    };
    
    // Actualizar el estado local
    setActiveFragment(updatedFragment);
    
    // Mostrar notificación de éxito
    toast.success(`Archivo ${path.split('/').pop()} actualizado correctamente`);
  };
  
  // Función para ejecutar el código editado
  const handleExecuteCode = (files: { [path: string]: string }) => {
    if (!activeFragment) return;
    
    // Verificar si el usuario tiene permiso para editar código
    if (!canEditCode()) {
      toast.error("Esta función requiere plan Pro. Por favor, actualiza tu plan.");
      return;
    }
    
    setIsExecuting(true);
    
    // Encontrar el archivo principal (Python)
    const mainFile = Object.keys(files).find(file => 
      file.endsWith(".py") && !file.startsWith("_")
    );
    
    executeCodeMutation.mutate({
      projectId,
      files,
      mainFile
    });
  };

  return (
    <div className="h-screen">
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel
              defaultSize={35}
              minSize={20}
              className="flex flex-col min-h-0"

            >
            <ErrorBoundary fallback={<p>Project header error</p>}>
            <Suspense fallback={<p>Loading project...</p>}>
             <ProjectHeader projectId={projectId} />
            </Suspense>
            </ErrorBoundary>
            <ErrorBoundary fallback={<p>Messages container error</p>}>
            <Suspense fallback={<p>Loading messages...</p>}>
              <MessagesContainer 
                projectId={projectId}
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
                />
            </Suspense>
            </ErrorBoundary>
            </ResizablePanel>
            <ResizableHandle className="hover:bg-primary transition-colors" />
            <ResizablePanel
              defaultSize={65}
              minSize={50}
            >
              <Tabs
                className="h-full gap-y-0"
                defaultValue="preview"
                value={tabState}
                onValueChange={(value) => setTabState(value as "preview" | "code")}
              >
                <div className="w-full flex items-center p-2 border-b gap-x-2">
                  <TabsList className="h-8 p-0 border rounded-md">
                    <TabsTrigger value="preview" className="rounded-md">
                      <EyeIcon/> <span>Demo</span>
                    </TabsTrigger>
                    <TabsTrigger value="code" className="rounded-md">
                      <CodeIcon/> <span>Code</span>
                    </TabsTrigger>
                  </TabsList>
                  <div className="ml-auto flex items-center-center gap-x-2">
                    {!hasPro && (
                    <Button asChild size="sm" variant="tertiary">
                      <Link href="/pricing">
                        <CrownIcon/> Upgrade
                      </Link>
                    </Button>)}
                    <UserControl />
                  </div>
                </div>
                <TabsContent value="preview">
                  {!!activeFragment && <FragmentWeb data={activeFragment} />}
                </TabsContent>
                <TabsContent value="code" className="h-[calc(100%-45px)] relative">
                  {activeFragment?.files && (
                    <div className="relative h-full">
                      <FileExplorer 
                        files={activeFragment.files as { [path: string]: string }} 
                        onFileChange={canEditCode() ? handleFileChange : undefined}
                        onExecuteCode={canEditCode() ? handleExecuteCode : undefined}
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ResizablePanel>
        </ResizablePanelGroup>
    </div>
  );
};
