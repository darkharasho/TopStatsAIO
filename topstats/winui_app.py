"""WinUI 3 interface for TopStatsAIO.

This module provides a basic WinUI 3 application using the `win32more` Python
bindings.  Users can pick a folder containing ``.zevtc`` logs, select the files
to process and trigger the aggregation step.  The window applies a Mica
backdrop and is intended as the foundation for a richer interface.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import ctypes
from ctypes import wintypes

from win32more.xaml import XamlApplication
from win32more.Windows.Foundation import PropertyValue
from win32more.Microsoft.UI.Xaml import Window
from win32more.Microsoft.UI.Xaml.Controls import (
    Button,
    CheckBox,
    ListView,
    StackPanel,
    TextBlock,
    TextBox,
)
from win32more.Microsoft.UI.Xaml.Media import MicaBackdrop


def _browse_for_folder() -> str | None:
    """Invoke the native folder picker dialog and return the selected path."""

    class BROWSEINFO(ctypes.Structure):
        _fields_ = [
            ("hwndOwner", wintypes.HWND),
            ("pidlRoot", ctypes.c_void_p),
            ("pszDisplayName", wintypes.LPWSTR),
            ("lpszTitle", wintypes.LPCWSTR),
            ("ulFlags", wintypes.UINT),
            ("lpfn", ctypes.c_void_p),
            ("lParam", wintypes.LPARAM),
            ("iImage", ctypes.c_int),
        ]

    buffer = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
    bi = BROWSEINFO()
    bi.pszDisplayName = buffer
    bi.lpszTitle = "Select Log Folder"
    bi.ulFlags = 0x0001 | 0x0040  # BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE
    pidl = ctypes.windll.shell32.SHBrowseForFolderW(ctypes.byref(bi))
    if pidl:
        path_buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetPathFromIDListW(pidl, path_buf)
        ctypes.windll.ole32.CoTaskMemFree(pidl)
        return path_buf.value
    return None


class TopStatsWinUIApp(XamlApplication):
    """Primary WinUI application."""

    def OnLaunched(self, args) -> None:  # pragma: no cover - GUI initialisation
        self._checked: set[str] = set()

        win = Window()
        win.Title = "TopStatsAIO"
        win.SystemBackdrop = MicaBackdrop()

        root = StackPanel()

        self.path_text = TextBlock()
        self.path_text.Text = "No folder selected."
        root.Children.Append(self.path_text)

        select_btn = Button()
        select_btn.Content = PropertyValue.CreateString("Select Folder")
        select_btn.add_Click(self._on_select_folder)
        root.Children.Append(select_btn)

        self.file_list = ListView()
        root.Children.Append(self.file_list)

        gen_btn = Button()
        gen_btn.Content = PropertyValue.CreateString("Generate Aggregate")
        gen_btn.add_Click(self._on_generate)
        root.Children.Append(gen_btn)

        self.output = TextBox()
        self.output.IsReadOnly = True
        self.output.AcceptsReturn = True
        self.output.Height = 200
        root.Children.Append(self.output)

        win.Content = root
        win.Activate()

    # ------------------------------------------------------------------ events
    def _on_select_folder(self, sender, args) -> None:
        path = _browse_for_folder()
        if path:
            self.root_path = path
            self.path_text.Text = f"Folder: {path}"
            self._populate_file_list(path)

    def _populate_file_list(self, path: str) -> None:
        self.file_list.Items.Clear()
        self._checked.clear()
        for root, _, files in os.walk(path):
            for name in files:
                if name.lower().endswith(".zevtc"):
                    full = os.path.join(root, name)
                    cb = CheckBox()
                    cb.Content = PropertyValue.CreateString(os.path.relpath(full, path))
                    cb.Tag = full
                    cb.add_Checked(self._on_checked)
                    cb.add_Unchecked(self._on_unchecked)
                    self.file_list.Items.Append(cb)

    def _on_checked(self, sender, args) -> None:
        self._checked.add(sender.Tag)

    def _on_unchecked(self, sender, args) -> None:
        self._checked.discard(sender.Tag)

    def _on_generate(self, sender, args) -> None:
        if not getattr(self, "root_path", None):
            self._log("No folder selected.")
            return
        if not self._checked:
            self._log("No files selected.")
            return

        temp_dir = tempfile.mkdtemp()
        for src in self._checked:
            try:
                shutil.copy(src, temp_dir)
                self._log(f"Copied {os.path.basename(src)}")
            except Exception as exc:  # pragma: no cover - best effort logging
                self._log(f"Error copying {src}: {exc}")
        self._log(f"Files copied to {temp_dir}")

    # ----------------------------------------------------------------- helpers
    def _log(self, message: str) -> None:
        self.output.Text += message + "\n"


def run() -> None:
    """Run the WinUI application."""

    XamlApplication.Start(TopStatsWinUIApp)

