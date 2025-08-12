"""Application entry point.

This project now targets Windows and launches the WinUI interface directly.
"""

from topstats.winui_app import run


def main() -> None:
    """Start the WinUI application."""
    try:
        run()
    except Exception as exc:  # pragma: no cover - surface any startup error
        print(f"Failed to start WinUI frontend: {exc}")


if __name__ == "__main__":  # pragma: no cover - script entry point
    main()

