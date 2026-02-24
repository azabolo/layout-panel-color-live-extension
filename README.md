# Layout Panel Color Live (GNOME Extension)

Changes top panel and Ubuntu Dock color based on active keyboard layout (EN/RU).

## Features
- Separate toggles for top panel and dock coloring
- Custom EN and RU colors
- Optional right-side dock flag-like strip with adjustable width and edge offset
- Preferences window via GNOME Extensions app

## Install (local)
1. Copy this folder to:
   `~/.local/share/gnome-shell/extensions/layout-panel-color-live@anton.local/`
2. Compile schemas:
   `glib-compile-schemas ~/.local/share/gnome-shell/extensions/layout-panel-color-live@anton.local/schemas`
3. Enable extension:
   `gnome-extensions enable layout-panel-color-live@anton.local`

## Preferences
Open:
`gnome-extensions prefs layout-panel-color-live@anton.local`
