import base64
import io
import time
from typing import Tuple, List, Optional
import pyautogui
from PIL import Image
import mss

# PyAutoGUI safety configuration
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

# Key name mapping from Anthropic standard key names to PyAutoGUI key names
KEY_MAP = {
    "Return": "enter",
    "Enter": "enter",
    "Tab": "tab",
    "space": "space",
    "BackSpace": "backspace",
    "backspace": "backspace",
    "Delete": "delete",
    "Escape": "esc",
    "esc": "esc",
    "Up": "up",
    "Down": "down",
    "Left": "left",
    "Right": "right",
    "Page_Up": "pageup",
    "Page_Down": "pagedown",
    "Home": "home",
    "End": "end",
    "Shift_L": "shiftleft",
    "Shift_R": "shiftright",
    "Control_L": "ctrlleft",
    "Control_R": "ctrlright",
    "Alt_L": "altleft",
    "Alt_R": "altright",
    "Super_L": "winleft",
    "Super_R": "winright",
    "win": "win",
    "ctrl": "ctrl",
    "alt": "alt",
    "shift": "shift",
}

class WindowsDisplay:
    def __init__(self, target_resolution: Optional[Tuple[int, int]] = None):
        """
        Initialize Windows Display Controller.
        :param target_resolution: Optional (width, height) to resize screenshots to.
                                   If None, native display resolution is used.
        """
        self.mss = mss.mss()
        monitor = self.mss.monitors[1]  # Primary monitor
        self.display_width = monitor["width"]
        self.display_height = monitor["height"]
        
        if target_resolution:
            self.screenshot_width, self.screenshot_height = target_resolution
        else:
            self.screenshot_width = self.display_width
            self.screenshot_height = self.display_height

    def to_display(self, coordinate: List[int]) -> Tuple[int, int]:
        """Convert screenshot coordinate [x, y] to native display pixel position."""
        x, y = coordinate[0], coordinate[1]
        if not (0 <= x <= self.screenshot_width and 0 <= y <= self.screenshot_height):
            raise ValueError(f"Coordenada [{x}, {y}] fuera del rango de la captura ({self.screenshot_width}x{self.screenshot_height}).")
        
        real_x = int(x * self.display_width / self.screenshot_width)
        real_y = int(y * self.display_height / self.screenshot_height)
        return real_x, real_y

    def to_screenshot(self, x: int, y: int) -> Tuple[int, int]:
        """Convert native display pixel position (x, y) to screenshot coordinate."""
        sc_x = int(x * self.screenshot_width / self.display_width)
        sc_y = int(y * self.screenshot_height / self.display_height)
        return sc_x, sc_y

    def png_base64(self) -> str:
        """Capture screenshot of the primary display, optionally resize it, and return base64 string."""
        sct_img = self.mss.grab(self.mss.monitors[1])
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
        
        if (self.screenshot_width, self.screenshot_height) != (self.display_width, self.display_height):
            img = img.resize((self.screenshot_width, self.screenshot_height), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def zoom(self, region: List[int]) -> str:
        """
        Crop a specific region [x0, y0, x1, y1] from screen and scale it.
        """
        x0, y0 = self.to_display([region[0], region[1]])
        x1, y1 = self.to_display([region[2], region[3]])
        
        min_x, max_x = min(x0, x1), max(x0, x1)
        min_y, max_y = min(y0, y1), max(y0, y1)
        
        sct_img = self.mss.grab(self.mss.monitors[1])
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
        
        cropped = img.crop((min_x, min_y, max_x, max_y))
        cropped.thumbnail((self.screenshot_width, self.screenshot_height), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def scroll(self, scroll_direction: str, scroll_amount: int, coordinate: Optional[List[int]] = None):
        """Perform mouse scroll."""
        if coordinate:
            real_x, real_y = self.to_display(coordinate)
            pyautogui.moveTo(real_x, real_y)

        amount = int(scroll_amount)
        if scroll_direction == "up":
            pyautogui.scroll(amount * 100)
        elif scroll_direction == "down":
            pyautogui.scroll(-amount * 100)
        elif scroll_direction == "right":
            pyautogui.hscroll(amount * 100)
        elif scroll_direction == "left":
            pyautogui.hscroll(-amount * 100)

    def cursor(self) -> Tuple[int, int]:
        """Return current mouse position in screenshot scale."""
        pos = pyautogui.position()
        return self.to_screenshot(pos.x, pos.y)

    def click(self, coordinate: Optional[List[int]] = None, button: str = "left", text_modifier: Optional[str] = None):
        """Perform a mouse click at coordinate or current position."""
        if coordinate:
            real_x, real_y = self.to_display(coordinate)
        else:
            real_x, real_y = pyautogui.position()

        modifier_key = KEY_MAP.get(text_modifier, text_modifier) if text_modifier else None

        if modifier_key:
            pyautogui.keyDown(modifier_key)

        try:
            pyautogui.click(x=real_x, y=real_y, button=button)
        finally:
            if modifier_key:
                pyautogui.keyUp(modifier_key)

    def double_click(self, coordinate: Optional[List[int]] = None):
        if coordinate:
            real_x, real_y = self.to_display(coordinate)
        else:
            real_x, real_y = pyautogui.position()
        pyautogui.doubleClick(x=real_x, y=real_y)

    def triple_click(self, coordinate: Optional[List[int]] = None):
        if coordinate:
            real_x, real_y = self.to_display(coordinate)
        else:
            real_x, real_y = pyautogui.position()
        pyautogui.tripleClick(x=real_x, y=real_y)

    def drag(self, start_coordinate: List[int], coordinate: List[int]):
        start_x, start_y = self.to_display(start_coordinate)
        end_x, end_y = self.to_display(coordinate)
        pyautogui.moveTo(start_x, start_y)
        pyautogui.dragTo(end_x, end_y, button="left", duration=0.5)

    def move(self, coordinate: List[int]):
        real_x, real_y = self.to_display(coordinate)
        pyautogui.moveTo(real_x, real_y)

    def type(self, text: str):
        pyautogui.write(text, interval=0.02)

    def press_key(self, key_name: str, repeat: int = 1):
        mapped_key = KEY_MAP.get(key_name, key_name.lower())
        for _ in range(max(1, repeat)):
            pyautogui.press(mapped_key)
            time.sleep(0.05)

    def shortcut(self, keys: List[str]):
        mapped_keys = [KEY_MAP.get(k, k.lower()) for k in keys]
        pyautogui.hotkey(*mapped_keys)

    def close(self):
        self.mss.close()
