import { Fragment } from "@/generated/prisma";
import { useState, useEffect } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { toast } from "sonner";

interface Props {
    data: Fragment;
}

export function FragmentWeb({ data }: Props) {
    const [copied, setCopied] = useState(false);
    const [fragmentKey, setFragmentKey] = useState(0);
    const [useFallbackVideo, setUseFallbackVideo] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [videoError, setVideoError] = useState(false);
    
    // URL para el video almacenado en la base de datos
    const fallbackVideoUrl = `${window.location.origin}/api/video/${data.id}`;
    
    // Comprobar si el sandbox está disponible y preparar el fallback al video almacenado
    useEffect(() => {
        if (!data.sandboxUrl) return;
        
        const checkSandboxAvailability = async () => {
            try {
                setIsLoading(true);
                
                // Validar primero si la URL del sandbox parece válida
                if (!data.sandboxUrl.includes('.e2b.app')) {
                    console.log('URL del sandbox no válida, usando video almacenado');
                    setUseFallbackVideo(true);
                    return;
                }
                
                const testUrl = new URL(data.sandboxUrl);
                
                // Aumentamos el timeout a 5 segundos para dar más margen en redes lentas
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                try {
                    // Intentar obtener la imagen sin errores CORS
                    const imgResponse = await fetch(`${testUrl.origin}/favicon.ico`, { 
                        method: 'HEAD',
                        signal: controller.signal,
                        mode: 'no-cors' // Evita errores CORS
                    });
                    
                    // Verificación adicional: comprobar si la URL del sandbox contiene la parte esperada
                    // Esta es una heurística para detectar si el sandbox sigue activo
                    if (data.sandboxUrl.includes('/output/') && data.sandboxUrl.endsWith('.mp4')) {
                        console.log('URL parece ser de un video MP4, verificando...');
                        
                        // Probar precargando la imagen en un elemento Image
                        const img = new Image();
                        let imageLoaded = false;
                        
                        // Promise para controlar el timeout de carga de imagen
                        await new Promise((resolve) => {
                            const imgTimeout = setTimeout(() => {
                                if (!imageLoaded) {
                                    console.log('Timeout al cargar la imagen del sandbox');
                                    setUseFallbackVideo(true);
                                    resolve(false);
                                }
                            }, 3000);
                            
                            img.onload = () => {
                                imageLoaded = true;
                                clearTimeout(imgTimeout);
                                setUseFallbackVideo(false);
                                resolve(true);
                            };
                            
                            img.onerror = () => {
                                clearTimeout(imgTimeout);
                                console.log('Error using fallback video');
                                setUseFallbackVideo(true);
                                resolve(false);
                            };
                            
                            img.src = `${testUrl.origin}/favicon.ico`;
                        });
                    } else {
                        // Si no es una URL de video, asumir que el sandbox está disponible
                        setUseFallbackVideo(false);
                    }
                    
                } catch (err) {
                    console.log('Error using fallback video:', err);
                    setUseFallbackVideo(true);
                } finally {
                    clearTimeout(timeoutId);
                }
            } catch (error) {
                console.log('Error using fallback video:', error);
                setUseFallbackVideo(true);
            } finally {
                setIsLoading(false);
            }
        };
        
        checkSandboxAvailability();
        
        // También comprobamos nuevamente si hay problemas al cargar el iframe
        const checkInterval = setInterval(() => {
            // Si aún estamos usando el iframe y no está en fallback, verificar nuevamente
            if (!useFallbackVideo && data.sandboxUrl) {
                console.log('Verificación periódica del sandbox...');
                checkSandboxAvailability();
            }
        }, 30000); // Verificar cada 30 segundos
        
        return () => {
            clearInterval(checkInterval);
        };
    }, [data.sandboxUrl, data.id]);

    const onRefreshClick = () => {
        setFragmentKey((prev) => prev + 1);
        setVideoError(false);
    };

    const handleCopy = () => {
        const urlToCopy = useFallbackVideo ? fallbackVideoUrl : data.sandboxUrl;
        navigator.clipboard.writeText(urlToCopy);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    };
    
    const handleVideoError = () => {
        setVideoError(true);
        toast.error("Error using fallback video. Using stored video.");
        setUseFallbackVideo(true);
    };

    return (
        <div className="flex flex-col w-full h-full">
            <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
                <Hint text="Refresh" side="bottom" align="start">
                <Button variant="outline" size="sm" onClick={onRefreshClick}>
                    <RefreshCcwIcon />
                </Button>
                </Hint>
                <Hint text="Copy URL" side="bottom" align="start">
                <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={handleCopy}
                   disabled={(!data.sandboxUrl && !useFallbackVideo) || copied}
                   className="flex-1 justify-start text-start font-normal"
                >
                   <span className="truncate">
                     {useFallbackVideo ? "Storaged video" : data.sandboxUrl}
                     {isLoading && " (Checking availability...)"}
                   </span>
                </Button>
                </Hint>
                <Hint text="Open in a new tab" side="bottom" align="start">
                <Button 
                   variant="outline" 
                   size="sm"
                   disabled={(!data.sandboxUrl && !useFallbackVideo) || copied} 
                   onClick={() => {
                     const url = useFallbackVideo ? fallbackVideoUrl : data.sandboxUrl;
                     if (!url) return;
                     window.open(url, "_blank");
                   }}
                >
                   <ExternalLinkIcon />
                </Button>
                </Hint>
                {videoError && (
                  <Hint text="Error using fallback video" side="bottom" align="start">
                    <AlertTriangleIcon className="text-yellow-500" />
                  </Hint>
                )}
            </div>
            
            {/* Mostrar el video almacenado o el iframe del sandbox según corresponda */}
            {useFallbackVideo ? (
              <div className="h-full w-full flex items-center justify-center bg-black">
                <video 
                  key={`video-${fragmentKey}`}
                  className="max-h-full max-w-full" 
                  controls 
                  autoPlay 
                  loop
                  src={fallbackVideoUrl}
                  onError={(e) => {
                    console.error("Error using fallback video:", e);
                    toast.error("Error using fallback video. Please try again.");
                  }}
                >
                  Tu navegador no soporta la reproducción de videos.
                </video>
              </div>
            ) : (
              <div className="h-full w-full relative">
                <iframe
                  key={`iframe-${fragmentKey}`}
                  className="h-full w-full"
                  sandbox="allow-forms allow-scripts allow-same-origin"
                  loading="lazy"
                  src={data.sandboxUrl + "?key=" + fragmentKey}
                  // onError no funciona bien con iframes en React
                  // En su lugar, usamos un detector de eventos personalizado
                  ref={(iframe) => {
                    if (iframe) {
                      // Intentar detectar error en iframe
                      iframe.onerror = () => handleVideoError();
                      
                      // Agregar listener para mensaje de documento cargado
                      iframe.onload = () => {
                        try {
                          // Verificar si podemos acceder al contenido
                          // Si no podemos, es posible que el sandbox ya no exista
                          setTimeout(() => {
                            try {
                              if (iframe.contentWindow && 
                                  iframe.contentWindow.document && 
                                  iframe.contentWindow.document.body) {
                                console.log('Iframe cargado correctamente');
                                setVideoError(false);
                              }
                            } catch (err) {
                              // Error de acceso al contenido, probablemente por CORS
                              // Esto suele indicar que el sandbox ya no existe
                              console.error('Error accediendo al contenido del iframe');
                              handleVideoError();
                            }
                          }, 2000); // Dar tiempo para que cargue
                        } catch (e) {
                          console.error('Error al verificar el iframe:', e);
                          handleVideoError();
                        }
                      };
                    }
                  }}
                />
                
                {/* Mostrar overlay de carga mientras se verifica */}
                {isLoading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-white flex flex-col items-center gap-2">
                      <RefreshCcwIcon className="animate-spin" />
                      <p>Verifying...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
    );
};
