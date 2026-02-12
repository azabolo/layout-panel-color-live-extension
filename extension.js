import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const INPUT_SOURCES_SCHEMA = 'org.gnome.desktop.input-sources';
const POLL_INTERVAL_MS = 300;

const KEY_PANEL_ENABLED = 'panel-enabled';
const KEY_DOCK_ENABLED = 'dock-enabled';
const KEY_COLOR_EN = 'color-en';
const KEY_COLOR_RU = 'color-ru';

const DEFAULT_COLORS = {
    en: 'rgba(38, 86, 148, 0.92)',
    ru: 'rgba(132, 52, 63, 0.92)',
};

export default class LayoutPanelColorLive extends Extension {
    _inputSettings = null;
    _prefsSettings = null;
    _prefsSignalIds = [];
    _pollId = 0;
    _appliedLayout = null;
    _panelBaseStyle = '';
    _dockBaseStyleByActor = new Map();

    enable() {
        this._inputSettings = new Gio.Settings({schema_id: INPUT_SOURCES_SCHEMA});
        this._prefsSettings = this.getSettings();
        this._panelBaseStyle = Main.panel?.get_style?.() ?? '';

        this._prefsSignalIds.push(
            this._prefsSettings.connect(`changed::${KEY_PANEL_ENABLED}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_DOCK_ENABLED}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_COLOR_EN}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_COLOR_RU}`, () => this._reapplyCurrentLayout())
        );

        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_MS, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });

        this._tick();
    }

    disable() {
        if (this._pollId > 0) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }

        for (const id of this._prefsSignalIds)
            this._prefsSettings?.disconnect(id);
        this._prefsSignalIds = [];

        this._restorePanelStyle();
        this._restoreDockStyle();
        this._prefsSettings = null;
        this._inputSettings = null;
        this._appliedLayout = null;
    }

    _tick() {
        const layout = this._detectLayout();
        if (!layout)
            return;

        if (layout === this._appliedLayout) {
            // Dock actors can be recreated by Ubuntu Dock internals, so re-apply style.
            this._applyDockStyle(layout);
            return;
        }

        this._applyLayout(layout);
    }

    _reapplyCurrentLayout() {
        const layout = this._appliedLayout ?? this._detectLayout();
        if (!layout) {
            this._restorePanelStyle();
            this._restoreDockStyle();
            this._appliedLayout = null;
            return;
        }

        this._applyLayout(layout);
    }

    _applyLayout(layout) {
        this._applyPanelStyle(layout);
        this._applyDockStyle(layout);
        this._appliedLayout = layout;
    }

    _detectLayout() {
        // Prefer MRU: with Alt+Shift the 'current' index can lag behind, but MRU is up to date.
        const fromMru = this._layoutFromMru();
        if (fromMru)
            return fromMru;

        // Fallback to the keyboard indicator manager used by GNOME Shell UI.
        const fromIndicatorManager = this._layoutFromIndicatorManager();
        if (fromIndicatorManager)
            return fromIndicatorManager;

        return null;
    }

    _layoutFromIndicatorManager() {
        const indicator = Main.panel?.statusArea?.keyboard;
        const manager = indicator?._inputSourceManager ?? null;
        const source = manager?.currentSource ?? null;
        if (!source)
            return null;

        return this._normalizeLayout(source.shortName ?? source.xkbId ?? source.id ?? null);
    }

    _layoutFromMru() {
        if (!this._inputSettings)
            return null;

        const mru = this._inputSettings.get_value('mru-sources').deep_unpack();
        if (!Array.isArray(mru) || mru.length === 0)
            return null;

        const tuple = mru[0];
        if (!Array.isArray(tuple) || tuple.length < 2)
            return null;

        return this._normalizeLayout(tuple[1]);
    }

    _normalizeLayout(value) {
        if (!value || typeof value !== 'string')
            return null;

        const raw = value.trim().toLowerCase();
        const base = raw.split('+')[0].split(':')[0];
        if (base === 'ru' || base === 'рус' || base === 'ру' || base === 'рс')
            return 'ru';
        if (base === 'en' || base === 'us' || base === 'gb' || base === 'uk' || base === 'анг' || base === 'ен')
            return 'en';

        return null;
    }

    _applyPanelStyle(layout) {
        if (!Main.panel || typeof Main.panel.set_style !== 'function')
            return;

        if (!this._isPanelEnabled()) {
            Main.panel.set_style(this._panelBaseStyle || null);
            return;
        }

        const color = this._colorForLayout(layout);
        if (!color) {
            Main.panel.set_style(this._panelBaseStyle || null);
            return;
        }

        const base = (this._panelBaseStyle ?? '').trim();
        Main.panel.set_style(`${base} background-color: ${color}; transition-duration: 180ms;`.trim());
    }

    _applyDockStyle(layout) {
        if (!this._isDockEnabled()) {
            this._restoreDockStyle();
            return;
        }

        const color = this._colorForLayout(layout);
        const actors = this._findDockBackgroundActors();
        const alive = new Set(actors);

        for (const actor of actors) {
            if (!this._dockBaseStyleByActor.has(actor))
                // Preserve the actor's original style so disable/reset restores it exactly.
                this._dockBaseStyleByActor.set(actor, actor.get_style() ?? '');

            const base = this._dockBaseStyleByActor.get(actor) ?? '';
            if (color)
                actor.set_style(`${base.trim()} background-color: ${color}; transition-duration: 180ms;`.trim());
            else
                actor.set_style(base || null);
        }

        for (const actor of this._dockBaseStyleByActor.keys()) {
            if (!alive.has(actor))
                this._dockBaseStyleByActor.delete(actor);
        }
    }

    _restorePanelStyle() {
        if (Main.panel && typeof Main.panel.set_style === 'function')
            Main.panel.set_style(this._panelBaseStyle || null);
    }

    _restoreDockStyle() {
        for (const [actor, base] of this._dockBaseStyleByActor.entries())
            actor.set_style(base || null);

        this._dockBaseStyleByActor.clear();
    }

    _findDockBackgroundActors() {
        // Ubuntu Dock draws its background as actors with style class 'dash-background'.
        const results = [];
        const stack = [Main.layoutManager.uiGroup];

        while (stack.length > 0) {
            const actor = stack.pop();
            if (!actor)
                continue;

            if (typeof actor.has_style_class_name === 'function' &&
                actor.has_style_class_name('dash-background')) {
                results.push(actor);
            }

            if (typeof actor.get_children === 'function') {
                for (const child of actor.get_children())
                    stack.push(child);
            }
        }

        return results;
    }

    _isPanelEnabled() {
        return this._prefsSettings?.get_boolean(KEY_PANEL_ENABLED) ?? true;
    }

    _isDockEnabled() {
        return this._prefsSettings?.get_boolean(KEY_DOCK_ENABLED) ?? true;
    }

    _colorForLayout(layout) {
        if (layout === 'en') {
            const value = this._prefsSettings?.get_string(KEY_COLOR_EN)?.trim();
            return value || DEFAULT_COLORS.en;
        }

        if (layout === 'ru') {
            const value = this._prefsSettings?.get_string(KEY_COLOR_RU)?.trim();
            return value || DEFAULT_COLORS.ru;
        }

        return null;
    }
}
