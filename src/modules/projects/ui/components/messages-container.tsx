import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { MessageCard } from "./message-card";
import { useEffect, useRef } from "react";
import { MessageForm } from "./message-form";

interface Props {
    projectId: string;
}

export const MessagesContainer = ({ projectId }: Props) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const trpc = useTRPC();
    const { data: messages }  = useSuspenseQuery(trpc.messages.getMany.queryOptions({
        projectId: projectId,
    }));
    
    useEffect(() => {
        const lastAssistantMessage = messages?.findLast(
            (message) => message.role === "ASSISTANT"
        );
        if (lastAssistantMessage) {
            //TODO SET ACTIVE FRAGMENT    
        }
    }, [messages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages?.length]);

    return (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="pt-2 pr-1">
                {messages && messages.length > 0 ? (
                    messages.map((message) => (
                        <MessageCard 
                            key={message.id}
                            content={message.content}
                            role={message.role}
                            fragment={message.fragment}
                            createdAt={new Date(message.createdAt)}
                            isActiveFragment={false}
                            onFragmentClick={() => {}}
                            type={message.type}
                        />
                    ))
                ) : (
                    <div className="p-4 text-center text-gray-500">
                        No hay mensajes para mostrar
                    </div>
                )}
                <div ref={bottomRef}/>
            </div>
          </div>
          <div className="relative p-3 pt-1">
            <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
            <MessageForm projectId={projectId}/>
          </div>
        </div>
    );
};