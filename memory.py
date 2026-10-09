import json
import os
from typing import List, Dict

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "memory.json")

def load_memory() -> List[Dict[str, str]]:
    """Carga los recuerdos almacenados en el archivo JSON."""
    if not os.path.exists(MEMORY_FILE):
        return []
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_memory(memories: List[Dict[str, str]]):
    """Guarda los recuerdos en el archivo JSON."""
    try:
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(memories, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error al guardar memoria: {e}")

def add_memory_entry(title: str, details: str):
    """Añade una nueva entrada a la memoria a largo plazo."""
    memories = load_memory()
    # Evitar duplicados por título
    memories = [m for m in memories if m.get("title", "").lower() != title.lower()]
    memories.append({
        "title": title,
        "details": details
    })
    save_memory(memories)

def get_memory_context() -> str:
    """Genera el bloque de contexto de memoria para incluir en el SYSTEM_PROMPT."""
    memories = load_memory()
    if not memories:
        return "No hay recuerdos ni procedimientos previos almacenados."

    context = "### MEMORIA A LARGO PLAZO Y PROCEDIMIENTOS APRENDIDOS:\n"
    for idx, item in enumerate(memories, 1):
        context += f"{idx}. **{item.get('title')}**:\n   {item.get('details')}\n"
    return context
