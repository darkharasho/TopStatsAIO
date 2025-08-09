import ctypes as ct

def set_native_title_bar_theme(window, theme="dark"):
    window.update_idletasks()
    DWMWA_USE_IMMERSIVE_DARK_MODE = 20
    set_window_attribute = ct.windll.dwmapi.DwmSetWindowAttribute
    get_parent = ct.windll.user32.GetParent

    hwnd = get_parent(window.winfo_id())
    value = 2 if theme == "dark" else 0  # 2 = dark, 0 = light
    value = ct.c_int(value)
    set_window_attribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ct.byref(value), ct.sizeof(value))