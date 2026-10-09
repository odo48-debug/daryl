# DARYL - Agente de Control de Escritorio (Computer Use Agent)

Agente autónomo desarrollado en Python 3.12 basado en las especificaciones oficiales del **Computer Toolset SDK de Anthropic** (documentado en `instructions.md`). Este agente es capaz de tomar capturas de pantalla de tu sistema Windows, interpretar lo que ve y ejecutar acciones de teclado y ratón para controlar cualquier aplicación o programa de escritorio.

---

## 🏗️ Estructura del Proyecto

```
DARYL/
├── instructions.md         # Documentación oficial de Anthropic Computer Toolset SDK
├── display.py              # Controlador nativo de pantalla y periféricos (MSS + PyAutoGUI)
├── desktop_toolset.py      # Subclase de BetaAbstractComputerToolset20260801 con herramientas
├── agent.py                # Bucle de ejecución principal (tool_runner) y CLI
├── requirements.txt        # Dependencias del proyecto
└── .env.example            # Plantilla para la API Key de Anthropic
```

---

## ⚡ Requisitos e Instalación

1. **Entorno de Python**: Se recomienda usar un entorno virtual de Python 3.12.
2. **Instalar dependencias**:
   ```bash
   .\.venv\Scripts\pip.exe install -r requirements.txt
   ```
3. **Configurar la API Key**:
   Crea un archivo `.env` en la raíz del proyecto con tu clave de Anthropic:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

---

## 🚀 Uso del Agente

Para lanzar una instrucción al agente:

```bash
.\.venv\Scripts\python.exe agent.py "Abre la calculadora de Windows y realiza 150 multiplicado por 4"
```

O simplemente ejecutándolo de forma interactiva:
```bash
.\.venv\Scripts\python.exe agent.py
```

---

## 🔒 Seguridad y Guardarraíles (`confirm`)

De acuerdo con las directrices de `instructions.md`, las acciones de escritura y pulsaciones de teclas están protegidas con una función de confirmación (`confirm`). Puedes cambiar el parámetro `auto_approve=False` en `agent.py` si deseas que el sistema solicite aprobación manual antes de ejecutar cada interacción con el ratón o teclado.
