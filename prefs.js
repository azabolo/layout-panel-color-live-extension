import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const KEY_PANEL_ENABLED = 'panel-enabled';
const KEY_DOCK_ENABLED = 'dock-enabled';
const KEY_COLOR_EN = 'color-en';
const KEY_COLOR_RU = 'color-ru';
const KEY_DOCK_FLAG_ENABLED = 'dock-flag-enabled';
const KEY_DOCK_FLAG_WIDTH = 'dock-flag-width';
const KEY_DOCK_FLAG_OFFSET = 'dock-flag-offset';

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

function _createIntRow(settings, key, title, subtitle, min, max) {
    const row = new Adw.ActionRow({
        title,
        subtitle,
    });

    const adjustment = new Gtk.Adjustment({
        lower: min,
        upper: max,
        step_increment: 1,
        page_increment: 4,
    });

    const spin = new Gtk.SpinButton({
        adjustment,
        numeric: true,
        valign: Gtk.Align.CENTER,
    });
    spin.set_digits(0);
    spin.set_value(settings.get_int(key));

    settings.connect(`changed::${key}`, () => {
        const value = settings.get_int(key);
        if (spin.get_value_as_int() !== value)
            spin.set_value(value);
    });

    spin.connect('value-changed', () => {
        const value = spin.get_value_as_int();
        if (settings.get_int(key) !== value)
            settings.set_int(key, value);
    });

    row.add_suffix(spin);
    row.activatable_widget = spin;
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

        const dockFlagGroup = new Adw.PreferencesGroup({
            title: _('Dock Flag Strip'),
            description: _('Add a narrow flag-like strip on the right edge of the Dock for active layout.'),
        });

        const dockFlagEnabledRow = new Adw.SwitchRow({
            title: _('Enable Strip'),
            subtitle: _('Show a right-side strip with EN/RU-style flag coloring.'),
        });
        settings.bind(KEY_DOCK_FLAG_ENABLED, dockFlagEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dockFlagGroup.add(dockFlagEnabledRow);

        const dockFlagWidthRow = _createIntRow(
            settings,
            KEY_DOCK_FLAG_WIDTH,
            _('Strip Width'),
            _('Width in pixels of the right-side strip.'),
            2,
            64
        );
        dockFlagGroup.add(dockFlagWidthRow);

        const dockFlagOffsetRow = _createIntRow(
            settings,
            KEY_DOCK_FLAG_OFFSET,
            _('Strip Offset'),
            _('Offset in pixels from the right edge of the dock.'),
            0,
            64
        );
        dockFlagGroup.add(dockFlagOffsetRow);

        const syncDockFlagSensitivity = () => {
            const enabled = settings.get_boolean(KEY_DOCK_FLAG_ENABLED);
            dockFlagWidthRow.set_sensitive(enabled);
            dockFlagOffsetRow.set_sensitive(enabled);
        };
        settings.connect(`changed::${KEY_DOCK_FLAG_ENABLED}`, syncDockFlagSensitivity);
        syncDockFlagSensitivity();

        page.add(dockFlagGroup);

        window.add(page);
    }
}
