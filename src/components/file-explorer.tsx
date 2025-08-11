import { CopyCheckIcon, CopyIcon, EditIcon, PlayIcon } from "lucide-react";

import { useState, useMemo, useCallback, Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { convertFilesToTreeItems } from "@/lib/utils";
import { CodeView } from "@/components/code-view";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis } from "@/components/ui/breadcrumb";
import { TreeView } from "./tree-view";

type FileCollection = { [path: string]: string };

function getLanguageFromExtension(filename: string): string {
   const extension = filename.split(".").pop()?.toLowerCase();
   return extension || "text";
}

interface FileBreadcrumbProps {
    filePath: string;
}

const FileBreadcrumb = ({ filePath }: FileBreadcrumbProps) => {
    const pathSegments = filePath.split("/");
    const maxSegments = 4;
    
    const renderBreadcrumbItems = () => {
        if (pathSegments.length <= maxSegments) {
            // Show all segments if 4 or less
            return pathSegments.map((segment, index) => {
                const isLast = index === pathSegments.length - 1;

                return (
                    <Fragment key={index}>
                        <BreadcrumbItem>
                            {isLast ? (
                                <BreadcrumbPage className="font-medium">
                                    {segment}
                                </BreadcrumbPage>
                            ) : (
                              <span className="text-muted-foreground">
                                {segment}
                              </span>
                            )}
                        </BreadcrumbItem>
                        {!isLast && <BreadcrumbSeparator />}
                    </Fragment>
                );
            });
        } else {
            const firstSegment = pathSegments[0];
            const lastSegment = pathSegments[pathSegments.length - 1];
            
            return (
               <>
                 <BreadcrumbItem>
                   <span className="text-muted-foreground">
                     {firstSegment}
                   </span>
                 </BreadcrumbItem>
                 <BreadcrumbSeparator />
                 <BreadcrumbItem>
                   <BreadcrumbEllipsis />
                 </BreadcrumbItem>
                 <BreadcrumbSeparator />
                 <BreadcrumbItem>
                   <BreadcrumbPage className="font-medium">
                     {lastSegment}
                   </BreadcrumbPage>
                 </BreadcrumbItem>
               </>
            );
        }
    };

        return (
            <Breadcrumb>
                <BreadcrumbList>
                    {renderBreadcrumbItems()}
                </BreadcrumbList>
            </Breadcrumb>
        )
      };

interface FileExplorerProps {
 files: FileCollection;
 onFileChange?: (path: string, content: string) => void;
 onExecuteCode?: (files: FileCollection) => void;
};

export const FileExplorer = ({ 
    files,
    onFileChange,
    onExecuteCode
}: FileExplorerProps) => {
const [copied, setCopied] = useState(false);
const [editMode, setEditMode] = useState(false);
const [isExecuting, setIsExecuting] = useState(false);
const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    // Filtrar los campos especiales para la selección inicial
    const fileKeys = Object.keys(files).filter(key => {
        // Excluir campos que comienzan con __
        if (key.startsWith('__')) return false;
        
        // Excluir campos específicos relacionados con el video
        const excludedFields = [
            'video_data', 'videodata', 'videoData',
            'video_mime_type', 'videomimetype', 'videoMimeType',
            'video_mime', 'videomime', 'videoMime'
        ];
        
        return !excludedFields.some(field => 
            key.toLowerCase() === field.toLowerCase() || 
            key.toLowerCase().includes(field.toLowerCase())
        );
    });
    
    // Priorizar archivos Python (.py) si existen
    const pythonFiles = fileKeys.filter(key => key.toLowerCase().endsWith('.py'));
    if (pythonFiles.length > 0) {
        return pythonFiles[0];
    }
    
    return fileKeys.length > 0 ? fileKeys[0] : null;
});

const treeData = useMemo(() => {
    return convertFilesToTreeItems(files);
}, [files]);

const handleFileSelect = useCallback((
    filePath: string
) => {
  if (files[filePath]) {
    setSelectedFile(filePath);
  }
}, [files]);

const handleCopy = useCallback(() => {
    if (selectedFile) {
        navigator.clipboard.writeText(files[selectedFile]);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    }
}, [selectedFile, files]);

const handleCodeChange = useCallback((newCode: string) => {
    if (selectedFile && onFileChange) {
        onFileChange(selectedFile, newCode);
    }
}, [selectedFile, onFileChange]);

const toggleEditMode = useCallback(() => {
    setEditMode(!editMode);
}, [editMode]);

const handleExecuteCode = useCallback(() => {
    if (onExecuteCode) {
        setIsExecuting(true);
        try {
            onExecuteCode(files);
        } finally {
            // Normalmente esto se haría después de que la ejecución termine
            // pero por ahora lo hacemos inmediatamente
            setTimeout(() => setIsExecuting(false), 1000);
        }
    }
}, [files, onExecuteCode]);

    return (
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={30} minSize={30} className="bg-sidebar">
                <TreeView
                   data={treeData}
                   value={selectedFile}
                   onSelect={handleFileSelect}
                />
            </ResizablePanel>
            <ResizableHandle className="hover:bg-primary transition-colors" />
            <ResizablePanel defaultSize={70} minSize={50}>
                {selectedFile && files[selectedFile] ? (
                    <div className="h-full w-full flex flex-col">
                        <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center gap-x-2">
                            <FileBreadcrumb filePath={selectedFile} />
                            <div className="flex gap-2 ml-auto">
                                {onFileChange ? (
                                    <Hint text={editMode ? "Disable editing" : "Enable editing"} side="bottom">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={toggleEditMode}
                                        >
                                            <EditIcon className={editMode ? "text-primary" : ""} />
                                        </Button>
                                    </Hint>
                                ) : (
                                    <Hint text="Pro Plan required" side="bottom">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled
                                        >
                                            <EditIcon className="text-muted-foreground" />
                                        </Button>
                                    </Hint>
                                )}
                                {onExecuteCode ? (
                                    <Hint text="Execute code" side="bottom">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleExecuteCode}
                                            disabled={isExecuting}
                                            className={isExecuting ? "animate-pulse" : ""}
                                        >
                                            <PlayIcon className="text-green-500" />
                                        </Button>
                                    </Hint>
                                ) : (
                                    <Hint text="Pro Plan required" side="bottom">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled
                                        >
                                            <PlayIcon className="text-muted-foreground" />
                                        </Button>
                                    </Hint>
                                )}
                                <Hint text="Copy to clipboard" side="bottom">
                                    <Button
                                       variant="outline"
                                       size="icon"
                                       onClick={handleCopy}
                                       disabled={copied}
                                    >
                                       {copied ? <CopyCheckIcon /> : <CopyIcon />}
                                    </Button>
                                </Hint>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <div className="relative">
                                <CodeView
                                    code={files[selectedFile]}
                                    lang={getLanguageFromExtension(selectedFile)}
                                    onCodeChange={handleCodeChange}
                                    readOnly={!editMode || !onFileChange}
                                />
                                {!onFileChange && (
                                    <div className="absolute top-2 right-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs px-2 py-1 rounded-md border border-yellow-500/20">
                                        Read only
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Select a file to view it's content
                  </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
    
};





