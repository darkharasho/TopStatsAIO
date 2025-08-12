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
            window._pywinstyle = pywinstyles.apply_style(window, style)
            # Key out the theme background so the blurred Mica/Acrylic
            # effect shows through without making the entire window
            # invisible.
            bg = window.tk.call("ttk::style", "lookup", ".", "-background")
            window.configure(bg=bg)
            window.attributes("-transparentcolor", bg)
        except Exception:
            pass
