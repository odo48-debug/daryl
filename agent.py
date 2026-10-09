import os
import sys
import json
from dotenv import load_dotenv
from anthropic import Anthropic
from anthropic.tools.computer import BetaComputerConfirmContext

from display import WindowsDisplay
from desktop_toolset import WindowsDesktopToolset
from hud import DarylHUD, set_terminal_always_on_top
from memory import get_memory_context, add_memory_entry

load_dotenv()

NOT_EXECUTED = "Not executed: an earlier action in this turn failed."
MAX_INNER_TURNS = 50

BASE_SYSTEM_PROMPT = """Eres DARYL, un agente autónomo de control de escritorio para Windows.
Tu objetivo es completar las instrucciones del usuario de principio a fin de forma autónoma, rápida y continua.

REGLAS FUNDAMENTALES DE EJECUCIÓN:
1. AUTONOMÍA CONTINUA Y RÁPIDA: Ejecuta secuencias de acciones en lote (por ejemplo, hacer clic, escribir texto y solicitar una captura de pantalla final) en una misma respuesta para minimizar las idas y vueltas.
2. USO DE ZOOM: Si algún texto, botón o elemento de interfaz es pequeño o ilegible en la captura estándar, utiliza la herramienta 'zoom' con la región [x0, y0, x1, y1] para ampliar la zona y leer el texto con total claridad.
3. USO DE SCROLL: Utiliza la herramienta 'scroll' para desplazarte por listas, chats o páginas web cuando el elemento deseado no aparezca visible en pantalla.
4. SIN CHAT INTERMEDIO INNECESARIO: No te detengas solo para comentar el progreso parcial. Continúa realizando las acciones hasta completar el objetivo.
5. PREGUNTAS CRÍTICAS: Solo detente si existe una duda ambigua e insalvable (ej. múltiples contactos coincidentes).
"""

# Safety confirmation context handler
def make_confirm_handler(hud: DarylHUD, auto_approve: bool = True):
    def confirm(context: BetaComputerConfirmContext) -> bool:
        if auto_approve:
            hud.update_status(f"Acción: '{context.member}'", "working")
            print(f"  └─ [SEGURIDAD] Ejecutando '{context.member}'...")
            return True
        
        hud.update_status(f"Esperando confirmación: '{context.member}'", "waiting")
        input_details = json.dumps(context.input.to_dict(), indent=2, ensure_ascii=False)
        print(f"\n[SOLICITUD DE CONFIRMACIÓN]")
        print(f"Herramienta: {context.member}")
        print(f"Parámetros:\n{input_details}")
        ans = input("¿Permitir esta acción en tu equipo? (s/n): ").strip().lower()
        return ans in ("s", "si", "y", "yes")
    
    return confirm

def execute_turn(client: Anthropic, model_name: str, desktop: WindowsDesktopToolset, messages: list, hud: DarylHUD):
    """
    Ejecuta el bucle de interacción de herramientas inyectando la memoria dinámica en el SYSTEM_PROMPT.
    """
    system_prompt = BASE_SYSTEM_PROMPT + "\n\n" + get_memory_context()
    turns_executed = 0
    for turn in range(MAX_INNER_TURNS):
        turns_executed += 1
        hud.update_status("Pensando siguiente paso...", "working")
        try:
            response = client.beta.messages.create(
                model=model_name,
                max_tokens=2048,
                system=system_prompt,
                tools=[desktop],
                messages=messages,
            )
        except Exception as e:
            hud.update_status(f"Error API: {e}", "error")
            print(f"\n❌ [ERROR EN API DE ANTHROPIC]: {e}")
            break
            
        messages.append({"role": "assistant", "content": response.content})
        
        # Filtrar llamadas de herramientas pertenecientes al toolset del ordenador
        calls = [
            block for block in response.content
            if block.type == "tool_use" and getattr(block, "toolset_name", None) == desktop.toolset_name
        ]
        
        # Imprimir mensajes del asistente y acciones solicitadas
        for block in response.content:
            if block.type == "text" and block.text.strip():
                hud.update_status(f"Respondiendo...", "running")
                print(f"\n🤖 [DARYL]: {block.text}")
            elif block.type == "tool_use":
                hud.update_status(f"Acción: {block.name}", "working")
                print(f"🛠️ [ACCIÓN]: {block.name} -> {block.input}")

        # Si el modelo no solicitó ejecutar ninguna herramienta, la instrucción ha concluido
        if not calls:
            hud.update_status("Tarea completada - Esperando orden", "running")
            break
            
        # Ejecutar las herramientas y registrar los resultados
        results = []
        failed = False
        for call in calls:
            if failed:
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "toolset_name": call.toolset_name,
                    "content": NOT_EXECUTED,
                    "is_error": True,
                })
                continue
            
            try:
                res = desktop.tool_result(call)
                failed = bool(res.get("is_error"))
                results.append(res)
            except Exception as ex:
                failed = True
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "toolset_name": call.toolset_name,
                    "content": f"Error al ejecutar herramienta: {ex}",
                    "is_error": True,
                })

        # Adjuntar los resultados de las herramientas a la conversación
        messages.append({"role": "user", "content": results})
    
    if turns_executed >= MAX_INNER_TURNS:
        hud.update_status("Límite alcanzado - Escribe 'sigue'", "waiting")
        print(f"\n⚠️ [AVISO]: DARYL ha alcanzado el límite máximo de {MAX_INNER_TURNS} acciones para esta ráfaga. Puedes escribir 'sigue' para continuar.")

def main():
    model_name = os.getenv("MODEL_NAME", "claude-haiku-5-5")
    api_key = os.getenv("ANTHROPIC_API_KEY")
    
    if not api_key:
        print("❌ Error: No se encontró ANTHROPIC_API_KEY. Configúrala en el archivo .env")
        sys.exit(1)

    client = Anthropic(api_key=api_key)
    
    # Intentar fijar la ventana del terminal siempre arriba
    set_terminal_always_on_top()
    
    # Iniciar HUD flotante en esquina superior derecha
    hud = DarylHUD()
    hud.start()
    hud.update_status("Iniciando DARYL...", "waiting")

    print("=" * 60)
    print("🤖 DARYL - Agente de Control de Escritorio (con Memoria Persistente)")
    print(f"📌 Modelo activo: {model_name}")
    print("💡 Escribe 'recordar: Titulo | Detalle' para guardar un nuevo aprendizaje.")
    print("💡 Escribe 'salir' o 'exit' para finalizar la sesión.")
    print("=" * 60)

    display = WindowsDisplay(target_resolution=(1280, 720))
    confirm_fn = make_confirm_handler(hud=hud, auto_approve=True)
    
    messages = []
    
    try:
        with WindowsDesktopToolset(display, confirm=confirm_fn) as desktop:
            if len(sys.argv) > 1:
                single_instruction = " ".join(sys.argv[1:])
                print(f"\n📝 Instrucción recibida: '{single_instruction}'")
                messages.append({"role": "user", "content": single_instruction})
                execute_turn(client, model_name, desktop, messages, hud)
            else:
                while True:
                    try:
                        hud.update_status("Esperando tu instrucción...", "waiting")
                        user_input = input("\n👤 Tu instrucción > ").strip()
                        if not user_input:
                            continue
                        if user_input.lower() in ("salir", "exit", "quit"):
                            print("\n👋 Cerrando DARYL. ¡Hasta la próxima!")
                            break
                        
                        # Manejo especial de comando de memoria
                        if user_input.lower().startswith("recordar:") or user_input.lower().startswith("recuerda:"):
                            parts = user_input.split(":", 1)[1].split("|", 1)
                            title = parts[0].strip()
                            details = parts[1].strip() if len(parts) > 1 else title
                            add_memory_entry(title, details)
                            print(f"\n🧠 [MEMORIA DARYL]: Aprendizaje guardado con éxito -> '{title}'")
                            hud.update_status("Memoria guardada", "running")
                            continue

                        messages.append({"role": "user", "content": user_input})
                        execute_turn(client, model_name, desktop, messages, hud)
                        
                    except KeyboardInterrupt:
                        print("\n\n👋 Sesión interrumpida por el usuario. Cerrando DARYL...")
                        break
    finally:
        hud.stop()

if __name__ == "__main__":
    main()
