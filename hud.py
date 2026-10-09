import ctypes
import threading
import time
import tkinter as tk

def set_terminal_always_on_top():
    """Fija la ventana actual del terminal/consola en primer plano (Always on Top)."""
    try:
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            # HWND_TOPMOST = -1, SWP_NOMOVE = 0x0002, SWP_NOSIZE = 0x0001
            ctypes.windll.user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002)
    except Exception:
        pass

class DarylHUD:
    def __init__(self):
        self.root = None
        self.label = None
        self.thread = None
        self.running = False

    def start(self):
        set_terminal_always_on_top()
        self.running = True
        self.thread = threading.Thread(target=self._run_gui, daemon=True)
        self.thread.start()

    def _run_gui(self):
        try:
            self.root = tk.Tk()
            self.root.title("DARYL HUD")
            
            # Quitar bordes de ventana y mantener en primer plano absoluto
            self.root.overrideredirect(True)
            self.root.attributes("-topmost", True)
            self.root.attributes("-alpha", 0.85)  # Semitransparente
            
            # Posicionar en la esquina superior derecha del monitor
            screen_w = self.root.winfo_screenwidth()
            hud_w = 420
            hud_h = 45
            x_pos = screen_w - hud_w - 20
            y_pos = 20
            self.root.geometry(f"{hud_w}x{hud_h}+{x_pos}+{y_pos}")
            
            # Estilo de la barra flotante
            frame = tk.Frame(self.root, bg="#1e1e2e", bd=2, relief="ridge")
            frame.pack(fill="both", expand=True)
            
            self.label = tk.Label(
                frame,
                text="🤖 DARYL: Listo para recibir órdenes",
                font=("Consolas", 10, "bold"),
                fg="#a6e3a1",
                bg="#1e1e2e",
                anchor="w",
                padx=10
            )
            self.label.pack(fill="both", expand=True)
            
            self.root.mainloop()
        except Exception:
            pass

    def update_status(self, text: str, state: str = "running"):
        """
        Actualiza el mensaje y color del HUD.
        state options: 'running' (verde), 'working' (amarillo), 'waiting' (azul), 'error' (rojo)
        """
        if not self.root or not self.label:
            return
            
        colors = {
            "running": "#a6e3a1",   # Verde
            "working": "#f9e2af",   # Amarillo
            "waiting": "#89b4fa",   # Azul
            "error": "#f38ba8"      # Rojo
        }
        fg_color = colors.get(state, "#a6e3a1")
        
        # Limitar longitud para ajustar a la barra
        display_text = text if len(text) <= 50 else text[:47] + "..."
        
        try:
            self.root.after(0, lambda: self.label.config(text=f"🤖 {display_text}", fg=fg_color))
        except Exception:
            pass

    def stop(self):
        self.running = False
        if self.root:
            try:
                self.root.after(0, self.root.destroy)
            except Exception:
                pass
