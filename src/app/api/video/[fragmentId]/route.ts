import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fragmentId: string }> }
) {
  const params = await context.params;
  try {
    const fragmentId = params.fragmentId;

    if (!fragmentId) {
      return new NextResponse("Fragment ID is required", { status: 400 });
    }

    // Buscar el fragmento en la base de datos
    const fragment = await prisma.fragment.findUnique({
      where: {
        id: fragmentId,
      },
      select: {
        files: true,
      },
    });

    // Si no se encuentra el fragmento o no tiene datos de video, devolver un error
    if (!fragment || !fragment.files) {
      return new NextResponse("Video not found", { status: 404 });
    }

    // Extraer los datos del video del campo JSON
    const files = fragment.files as Record<string, any>;
    
    // Comprobar si el video está almacenado como URL en Vercel Blob Storage
    if (files["__video_url__"] && files["__video_mime_type__"]) {
      console.log("Video encontrado como URL en Blob Storage");
      
      // Redireccionar a la URL del video en Blob Storage
      return NextResponse.redirect(files["__video_url__"]);
    }
    
    // Comprobar si el video está almacenado en el formato anterior (campos separados)
    if (files["__video_data__"] && files["__video_mime_type__"]) {
      console.log("Video encontrado en formato anterior (campos separados)");
      
      // Convertir el string base64 a Buffer
      const videoBuffer = Buffer.from(files["__video_data__"], 'base64');
      const mimeType = files["__video_mime_type__"] || "video/mp4";
      
      // Devolver el video con el tipo MIME correcto
      return new NextResponse(videoBuffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": "inline",
          "Cache-Control": "public, max-age=31536000", // Cache por 1 año
        },
      });
    }
    
    // Comprobar si el video está almacenado en el formato antiguo (objeto __video__)
    const videoData = files["__video__"];
    if (videoData && videoData.data && videoData.mimeType) {
      console.log("Video encontrado en formato antiguo (objeto __video__)");
      
      // Convertir el string base64 a Buffer
      const videoBuffer = Buffer.from(videoData.data, 'base64');
      
      // Devolver el video con el tipo MIME correcto
      return new NextResponse(videoBuffer, {
        headers: {
          "Content-Type": videoData.mimeType || "video/mp4",
          "Content-Disposition": "inline",
          "Cache-Control": "public, max-age=31536000", // Cache por 1 año
        },
      });
    }
    
    // Si no se encuentra el video en ninguno de los formatos
    return new NextResponse("Video data not found", { status: 404 });
  } catch (error) {
    console.error("Error al obtener el video:", error);
    return new NextResponse("Error interno del servidor", { status: 500 });
  }
}
