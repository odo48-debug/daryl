"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";

const Page = () => {
    // Estado para la URL del video
    const [videoUrl, setVideoUrl] = useState("/file3.webm");
    
    // Actualizar la URL cuando estemos en el cliente
    useEffect(() => {
      setVideoUrl(`${window.location.origin}/file3.webm`);
    }, []);
    
    return (
      <div className="flex flex-col max-w-5xl mx-auto w-full">
        <section className="space-y-6 py-[16vh] 2xl:py-48">
          <div className="flex flex-col items-center">
            <Image 
               src="/logo.svg" 
               alt="Daryl Logo" 
               width={50} 
               height={50}
               className="hidden md:block" 
            />
          </div>
          
          <div className="flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="w-full mb-2">
              <div className="relative rounded-lg overflow-hidden bg-transparent" style={{ height: '50px' }}>
                <video 
                  src={videoUrl}
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full absolute top-1/2 -translate-y-1/2 object-cover"
                  style={{ mixBlendMode: 'normal' }}
                />
              </div>
            </div>
            
            <p className="text-lg md:text-xl text-muted-foreground text-center mt-2">
              Prompt and render. Visualize text and concepts with ease.
            </p>
          </div>
          <div className="max-w-3xl mx-auto w-full">
            <ProjectForm />
          </div>
          
        </section>
        <ProjectsList />
      </div>
      
     
    );
}

export default Page;
