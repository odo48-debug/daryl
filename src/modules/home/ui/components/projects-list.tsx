"use client";

import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const ProjectsList = () => {
    const trpc = useTRPC();
    const { user } = useUser();
    const queryClient = useQueryClient();
    const [hoveredProject, setHoveredProject] = useState<string | null>(null);
    const [editingProject, setEditingProject] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const { data: projects } = useQuery(trpc.projects.getMany.queryOptions());
    
    const deleteProject = useMutation(trpc.projects.delete.mutationOptions({
        onSuccess: () => {
            // Invalidar la caché para recargar la lista de proyectos
            queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());
            toast.success("Project deleted successfully");
        },
        onError: (error) => {
            toast.error(`Error deleting project: ${error.message}`);
        }
    }));
    
    const updateProject = useMutation(trpc.projects.update.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());
            setEditingProject(null);
            toast.success("Project name updated successfully");
        },
        onError: (error) => {
            toast.error(`Error updating project name: ${error.message}`);
        }
    }));
    
    const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (confirm("Are you sure you want to delete this project?")) {
            deleteProject.mutate({ id: projectId });
        }
    };
    
    const handleEditProject = (e: React.MouseEvent, projectId: string, currentName: string) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingProject(projectId);
        setNewProjectName(currentName);
    };
    
    const handleSaveProjectName = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (newProjectName.trim() === "") {
            toast.error("Project name cannot be empty");
            return;
        }
        
        updateProject.mutate({ id: projectId, name: newProjectName });
    };
    
    const handleCancelEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingProject(null);
    };
    
    useEffect(() => {
        if (editingProject && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingProject]);
    
    if (!user) {
        return null;
    }
    return (
        <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
           <h2 className="text-2xl font-semibold">
            {user?.firstName}&apos;s projects
           </h2>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
             {projects?.length === 0 && (
                <div className="col-span-full text-center">
                <p className="text-sm text-muted-foreground">
                    No projects found
                </p>
                </div>
             )}
             {projects?.map((project) => (
                <div
                    key={project.id}
                    className="relative"
                >
                {editingProject === project.id ? (
                    <div className="flex items-center gap-x-2 p-4 border rounded-md">
                        <Image
                            src="/logo.svg"
                            alt="Daryl"
                            width={32}
                            height={32}
                            className="object-contain"
                        />
                        <Input
                            ref={inputRef}
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSaveProjectName(e as any, project.id);
                                } else if (e.key === 'Escape') {
                                    handleCancelEdit(e as any);
                                }
                            }}
                        />
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => handleSaveProjectName(e, project.id)}
                        >
                            <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={handleCancelEdit}
                        >
                            <X className="h-4 w-4 text-red-500" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="outline"
                        className="font-normal h-auto justify-start w-full text-start p-4 relative group"
                        asChild
                        onMouseEnter={() => setHoveredProject(project.id)}
                        onMouseLeave={() => setHoveredProject(null)}
                    >
                    <Link href={`/projects/${project.id}`}>
                        <div className="flex items-center gap-x-4 w-full">
                            <Image
                                src="/logo.svg"
                                alt="Daryl"
                                width={32}
                                height={32}
                                className="object-contain"
                            />
                            <div className="flex flex-col flex-1">
                                <h3 className="truncate font-medium">
                                    {project.name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(project.updatedAt, { 
                                        addSuffix: true 
                                    })}
                                </p>
                            </div>
                            {hoveredProject === project.id && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 flex gap-x-1">
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={(e) => handleEditProject(e, project.id, project.name)}
                                    >
                                        <Pencil className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={(e) => handleDeleteProject(e, project.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Link>
                </Button>
                )}
                </div>
             ))}
            </div>

        </div>
    )
}