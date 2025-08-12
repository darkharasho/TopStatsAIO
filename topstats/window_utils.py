import os
import ctypes as ct

try:
    import pywinstyles  # type: ignore
except Exception:  # pragma: no cover - library only on Windows
    pywinstyles = None


def set_native_title_bar_theme(window, theme="dark"):
    """Set the native title bar theme and apply modern window styles."""
    if os.name != "nt":
        return

    window.update_idletasks()
    DWMWA_USE_IMMERSIVE_DARK_MODE = 20
    set_window_attribute = ct.windll.dwmapi.DwmSetWindowAttribute
    get_parent = ct.windll.user32.GetParent

    hwnd = get_parent(window.winfo_id())
    value = 2 if theme == "dark" else 0  # 2 = dark, 0 = light
    value = ct.c_int(value)
    set_window_attribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ct.byref(value), ct.sizeof(value))

    if pywinstyles:
        style = "mica" if theme == "dark" else "acrylic"
        try:
            # Apply the backdrop style while leaving widgets fully opaque so
            # panes and controls render normally over the blurred background.
            window._pywinstyle = pywinstyles.apply_style(window, style)
            # Slightly reduce backdrop opacity for a more authentic effect
            pywinstyles.set_opacity(window, value=0.9)
        except Exception:
            pass
