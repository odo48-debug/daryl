import time
from typing import Optional, List

from anthropic.tools import ToolError
from anthropic.tools.computer import (
    BetaAbstractComputerToolset20260801,
    BetaComputerCursorPositionResult,
    BetaScreenshotResult,
    BetaToolsetCallContext,
)
from anthropic.types.beta import (
    BetaComputerCursorPositionInput,
    BetaComputerKeyInput,
    BetaComputerLeftClickInput,
    BetaComputerRightClickInput,
    BetaComputerMiddleClickInput,
    BetaComputerDoubleClickInput,
    BetaComputerTripleClickInput,
    BetaComputerLeftClickDragInput,
    BetaComputerMouseMoveInput,
    BetaComputerScreenshotInput,
    BetaComputerTypeInput,
    BetaComputerZoomInput,
    BetaComputerScrollInput,
)

from display import WindowsDisplay

class WindowsDesktopToolset(BetaAbstractComputerToolset20260801):
    def __init__(self, display: WindowsDisplay, **options):
        super().__init__(**options)
        self.display = display

    def screenshot(
        self, context: BetaToolsetCallContext, input: BetaComputerScreenshotInput
    ) -> BetaScreenshotResult:
        """Capture screenshot of the desktop."""
        try:
            data = self.display.png_base64()
            return BetaScreenshotResult(data=data, media_type="image/png")
        except Exception as e:
            raise ToolError(f"Error al capturar pantalla: {e}")

    def zoom(
        self, context: BetaToolsetCallContext, input: BetaComputerZoomInput
    ) -> BetaScreenshotResult:
        """Capture zoomed region of the desktop."""
        try:
            data = self.display.zoom(input.region)
            return BetaScreenshotResult(data=data, media_type="image/png")
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error al hacer zoom: {e}")

    def scroll(
        self, context: BetaToolsetCallContext, input: BetaComputerScrollInput
    ) -> None:
        """Scroll mouse wheel in specified direction."""
        try:
            self.display.scroll(input.scroll_direction, input.scroll_amount, input.coordinate)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error al hacer scroll: {e}")

    def cursor_position(
        self, context: BetaToolsetCallContext, input: BetaComputerCursorPositionInput
    ) -> BetaComputerCursorPositionResult:
        """Get cursor position."""
        try:
            x, y = self.display.cursor()
            return BetaComputerCursorPositionResult(x=x, y=y)
        except Exception as e:
            raise ToolError(f"Error al obtener posición del cursor: {e}")

    def left_click(
        self, context: BetaToolsetCallContext, input: BetaComputerLeftClickInput
    ) -> None:
        """Perform a left click at coordinate or current cursor location."""
        try:
            self.display.click(input.coordinate, button="left", text_modifier=input.text)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error en clic izquierdo: {e}")

    def right_click(
        self, context: BetaToolsetCallContext, input: BetaComputerRightClickInput
    ) -> None:
        """Perform a right click."""
        try:
            self.display.click(input.coordinate, button="right", text_modifier=input.text)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error en clic derecho: {e}")

    def middle_click(
        self, context: BetaToolsetCallContext, input: BetaComputerMiddleClickInput
    ) -> None:
        """Perform a middle click."""
        try:
            self.display.click(input.coordinate, button="middle", text_modifier=input.text)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error en clic central: {e}")

    def double_click(
        self, context: BetaToolsetCallContext, input: BetaComputerDoubleClickInput
    ) -> None:
        """Perform a double click."""
        try:
            self.display.double_click(input.coordinate)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error en doble clic: {e}")

    def triple_click(
        self, context: BetaToolsetCallContext, input: BetaComputerTripleClickInput
    ) -> None:
        """Perform a triple click."""
        try:
            self.display.triple_click(input.coordinate)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error en triple clic: {e}")

    def left_click_drag(
        self, context: BetaToolsetCallContext, input: BetaComputerLeftClickDragInput
    ) -> None:
        """Drag left mouse button from start_coordinate to coordinate."""
        try:
            self.display.drag(input.start_coordinate, input.coordinate)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error al arrastrar: {e}")

    def mouse_move(
        self, context: BetaToolsetCallContext, input: BetaComputerMouseMoveInput
    ) -> None:
        """Move cursor to coordinate."""
        try:
            self.display.move(input.coordinate)
        except ValueError as ve:
            raise ToolError(str(ve))
        except Exception as e:
            raise ToolError(f"Error al mover ratón: {e}")

    def type(
        self, context: BetaToolsetCallContext, input: BetaComputerTypeInput
    ) -> None:
        """Type text into the active element."""
        try:
            self.display.type(input.text)
        except Exception as e:
            raise ToolError(f"Error al escribir texto: {e}")

    def key(
        self, context: BetaToolsetCallContext, input: BetaComputerKeyInput
    ) -> None:
        """Press key or key combination."""
        try:
            self.display.press_key(input.text, repeat=input.repeat or 1)
        except Exception as e:
            raise ToolError(f"Error al pulsar tecla '{input.text}': {e}")

    def close(self) -> None:
        super().close()
        self.display.close()
