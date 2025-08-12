import os

if os.name == "nt":
    try:
        from win32mica import ApplyMica, MicaTheme
    except Exception:  # pragma: no cover - win32mica may not be available
        ApplyMica = None
        MicaTheme = None
else:  # Non-Windows platforms do not support win32mica
    ApplyMica = None
    MicaTheme = None


def set_native_title_bar_theme(window, theme: str = "dark") -> None:
    """Apply the requested title bar theme using win32mica.

    Parameters
    ----------
    window:
        The Tk or Toplevel window to theme.
    theme:
        Either "dark" or "light".
    """

    if ApplyMica is None:
        return  # win32mica not available or not on Windows

    window.update_idletasks()

    bg = "#333333" if theme == "dark" else "#FFFFFF"
    try:
        window.configure(bg=bg)
    except Exception:
        pass

    try:
        hwnd = window.winfo_id()
        mica_theme = MicaTheme.DARK if theme == "dark" else MicaTheme.LIGHT
        ApplyMica(HWND=hwnd, Theme=mica_theme)
    except Exception:
        pass

