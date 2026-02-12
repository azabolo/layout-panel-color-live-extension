import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const KEY_PANEL_ENABLED = 'panel-enabled';
const KEY_DOCK_ENABLED = 'dock-enabled';
const KEY_COLOR_EN = 'color-en';
const KEY_COLOR_RU = 'color-ru';

const DEFAULT_COLOR_EN = 'rgba(38, 86, 148, 0.92)';
const DEFAULT_COLOR_RU = 'rgba(132, 52, 63, 0.92)';

function _parseColor(color, fallback) {
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(color))
        rgba.parse(fallback);
    return rgba;
}

function _createColorRow(settings, key, title, subtitle, fallback) {
    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const button = new Gtk.ColorButton({
        valign: Gtk.Align.CENTER,
    });
    button.set_use_alpha(true);

    let syncing = false;
    const syncFromSettings = () => {
        // Prevent feedback loop when settings update the widget and vice versa.
        syncing = true;
        button.set_rgba(_parseColor(settings.get_string(key), fallback));
        syncing = false;
    };
    syncFromSettings();

    settings.connect(`changed::${key}`, syncFromSettings);
    button.connect('notify::rgba', () => {
        if (syncing)
            return;
        settings.set_string(key, button.get_rgba().to_string());
    });

    row.add_suffix(button);
    row.activatable_widget = button;
    return row;
}

export default class LayoutPanelColorLivePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();

        const targetGroup = new Adw.PreferencesGroup({
            title: _('Apply Colors To'),
            description: _('Choose which panel areas should react to EN/RU layout changes.'),
        });

        const topPanelRow = new Adw.SwitchRow({
            title: _('Top Panel'),
            subtitle: _('Change the color of the top GNOME panel.'),
        });
        settings.bind(KEY_PANEL_ENABLED, topPanelRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        targetGroup.add(topPanelRow);

        const dockRow = new Adw.SwitchRow({
            title: _('Dock'),
            subtitle: _('Change the color of the Ubuntu Dock background.'),
        });
        settings.bind(KEY_DOCK_ENABLED, dockRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        targetGroup.add(dockRow);

        page.add(targetGroup);

        const colorGroup = new Adw.PreferencesGroup({
            title: _('Layout Colors'),
            description: _('Set colors used when current layout is EN or RU.'),
        });

        colorGroup.add(_createColorRow(
            settings,
            KEY_COLOR_EN,
            _('EN Layout Color'),
            _('Used when English layout is active.'),
            DEFAULT_COLOR_EN
        ));

        colorGroup.add(_createColorRow(
            settings,
            KEY_COLOR_RU,
            _('RU Layout Color'),
            _('Used when Russian layout is active.'),
            DEFAULT_COLOR_RU
        ));

        page.add(colorGroup);

        window.add(page);
    }
}
