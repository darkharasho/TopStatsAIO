import os

if os.name == "nt":
    try:
        from topstats.winui_app import run as run_winui
        run_winui()
    except Exception as exc:
        print(f"Failed to start WinUI frontend: {exc}")
        from topstats import app  # noqa: F401 - fallback to Tkinter
else:
    from topstats import app  # noqa: F401 - non-Windows fallback
