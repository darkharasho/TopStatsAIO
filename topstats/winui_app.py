from win32more.xaml import XamlApplication
from win32more.Microsoft.UI.Xaml import Window
from win32more.Microsoft.UI.Xaml.Media import MicaBackdrop
from win32more.Microsoft.UI.Xaml.Controls import StackPanel, TextBlock

class TopStatsWinUIApp(XamlApplication):
    """Minimal WinUI entry point with a Mica backdrop.

    This module provides a simple WinUI window using the Python bindings
    demonstrated in https://github.com/sotanakamura/winui-python.  The goal
    is to serve as a starting point for a full WinUI based rewrite of the
    Tkinter application.  Currently it only displays placeholder content.
    """

    def OnLaunched(self, args):
        win = Window()
        win.Title = "TopStatsAIO (WinUI prototype)"
        win.SystemBackdrop = MicaBackdrop()

        panel = StackPanel()
        text = TextBlock()
        text.Text = "WinUI interface under construction."
        panel.Children.Append(text)

        win.Content = panel
        win.Activate()


def run():
    """Run the WinUI application."""
    XamlApplication.Start(TopStatsWinUIApp)
