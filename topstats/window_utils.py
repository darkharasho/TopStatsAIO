import os

if os.name == "nt":
    try:
        from win32mica import ApplyMica, MicaTheme, MicaStyle
    except Exception:  # pragma: no cover - win32mica may not be available
        ApplyMica = None
        MicaTheme = None
        MicaStyle = None
else:  # Non-Windows platforms do not support win32mica
    ApplyMica = None
    MicaTheme = None
    MicaStyle = None


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

    try:
        window.configure(bg="systemTransparent")
        window.wm_attributes("-transparentcolor", "systemTransparent")
    except Exception:
        # Some Tk builds do not support transparent backgrounds
        pass

    def _apply_mica(attempt: int = 0) -> None:
        try:
            window.update_idletasks()
            hwnd = window.winfo_id()
            mica_theme = MicaTheme.DARK if theme == "dark" else MicaTheme.LIGHT
            result = ApplyMica(HWND=hwnd, Theme=mica_theme, Style=MicaStyle.DEFAULT)
            if result != 0 and attempt < 5:
                window.after(200, lambda: _apply_mica(attempt + 1))
        except Exception:
            if attempt < 5:
                window.after(200, lambda: _apply_mica(attempt + 1))

    window.after(100, _apply_mica)

