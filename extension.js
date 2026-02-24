import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const INPUT_SOURCES_SCHEMA = 'org.gnome.desktop.input-sources';
const POLL_INTERVAL_MS = 300;

const KEY_PANEL_ENABLED = 'panel-enabled';
const KEY_DOCK_ENABLED = 'dock-enabled';
const KEY_COLOR_EN = 'color-en';
const KEY_COLOR_RU = 'color-ru';
const KEY_DOCK_FLAG_ENABLED = 'dock-flag-enabled';
const KEY_DOCK_FLAG_WIDTH = 'dock-flag-width';
const KEY_DOCK_FLAG_OFFSET = 'dock-flag-offset';

const DEFAULT_COLORS = {
    en: 'rgba(38, 86, 148, 0.92)',
    ru: 'rgba(132, 52, 63, 0.92)',
};

const MIN_DOCK_FLAG_WIDTH = 2;
const MAX_DOCK_FLAG_WIDTH = 64;
const MAX_DOCK_FLAG_OFFSET = 64;
const DEFAULT_DOCK_FLAG_WIDTH = 12;
const DEFAULT_DOCK_FLAG_OFFSET = 0;

export default class LayoutPanelColorLive extends Extension {
    _inputSettings = null;
    _prefsSettings = null;
    _prefsSignalIds = [];
    _pollId = 0;
    _appliedLayout = null;
    _panelBaseStyle = '';
    _dockBaseStyleByActor = new Map();
    _dockFlagByActor = new Map();

    enable() {
        this._inputSettings = new Gio.Settings({schema_id: INPUT_SOURCES_SCHEMA});
        this._prefsSettings = this.getSettings();
        this._panelBaseStyle = Main.panel?.get_style?.() ?? '';

        this._prefsSignalIds.push(
            this._prefsSettings.connect(`changed::${KEY_PANEL_ENABLED}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_DOCK_ENABLED}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_COLOR_EN}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_COLOR_RU}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_DOCK_FLAG_ENABLED}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_DOCK_FLAG_WIDTH}`, () => this._reapplyCurrentLayout()),
            this._prefsSettings.connect(`changed::${KEY_DOCK_FLAG_OFFSET}`, () => this._reapplyCurrentLayout())
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
        this._restoreDockFlagStrips();
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
            this._restoreDockFlagStrips();
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
        const actors = this._findDockBackgroundActors();
        const alive = new Set(actors);

        if (this._isDockEnabled()) {
            const color = this._colorForLayout(layout);

            for (const actor of actors) {
                if (!actor || typeof actor.set_style !== 'function')
                    continue;

                if (!this._dockBaseStyleByActor.has(actor))
                    // Preserve the actor's original style so disable/reset restores it exactly.
                    this._dockBaseStyleByActor.set(actor, actor.get_style?.() ?? '');

                const base = this._dockBaseStyleByActor.get(actor) ?? '';
                if (color)
                    actor.set_style(`${base.trim()} background-color: ${color}; transition-duration: 180ms;`.trim());
                else
                    actor.set_style(base || null);
            }

            for (const actor of [...this._dockBaseStyleByActor.keys()]) {
                if (!alive.has(actor))
                    this._dockBaseStyleByActor.delete(actor);
            }
        } else {
            this._restoreDockStyle();
        }

        this._applyDockFlagStrips(layout, actors, alive);
    }

    _applyDockFlagStrips(layout, actors, alive) {
        if (!this._isDockFlagEnabled()) {
            this._restoreDockFlagStrips();
            return;
        }

        const spec = this._dockFlagSpecForLayout(layout);
        if (!spec) {
            this._restoreDockFlagStrips();
            return;
        }

        const width = this._dockFlagWidth();
        const offset = this._dockFlagOffset();

        for (const actor of actors) {
            const strip = this._ensureDockFlagStrip(actor, spec);
            if (!strip)
                continue;

            this._applyDockFlagSegments(strip, spec);
            this._positionDockFlagStrip(actor, strip, width, offset);
        }

        for (const [actor, strip] of [...this._dockFlagByActor.entries()]) {
            if (!alive.has(actor) || strip.get_parent?.() !== actor) {
                if (strip && typeof strip.destroy === 'function')
                    strip.destroy();
                this._dockFlagByActor.delete(actor);
            }
        }
    }

    _ensureDockFlagStrip(actor, spec) {
        if (!actor || typeof actor.add_child !== 'function')
            return null;

        let strip = this._dockFlagByActor.get(actor) ?? null;
        if (strip && strip.get_parent?.() === actor && strip._dockLayout === spec.layout)
            return strip;

        if (strip && typeof strip.destroy === 'function')
            strip.destroy();

        strip = new St.Widget({
            reactive: false,
            can_focus: false,
            track_hover: false,
            x_expand: false,
            y_expand: true,
        });
        strip._dockLayout = spec.layout;
        strip._dockVertical = spec.vertical;
        strip._appliedColors = [];
        strip._appliedSegments = [];
        actor.add_child(strip);

        if (typeof actor.set_child_above_sibling === 'function')
            actor.set_child_above_sibling(strip, null);

        this._dockFlagByActor.set(actor, strip);
        return strip;
    }

    _applyDockFlagSegments(strip, spec) {
        if (!strip)
            return;

        strip.set_style(`${spec.style}; transition-duration: 180ms;`);

        if (!Array.isArray(spec.colors))
            return;

        if (Array.isArray(strip._appliedColors) &&
            strip._appliedColors.length === spec.colors.length &&
            strip._appliedColors.every((color, index) => color === spec.colors[index])) {
            const oldRatios = Array.isArray(strip._dockRatios) ? strip._dockRatios : null;
            const newRatios = Array.isArray(spec.ratios) ? spec.ratios : null;

            const ratiosMatch = (oldRatios === null && newRatios === null)
                || (oldRatios !== null && newRatios !== null
                    && oldRatios.length === newRatios.length
                    && oldRatios.every((ratio, index) => ratio === newRatios[index]));

            if (ratiosMatch)
                return;
        }

        if (typeof strip.remove_all_children === 'function') {
            strip.remove_all_children();
            strip._appliedSegments = [];
        } else if (typeof strip.get_children === 'function') {
            for (const child of strip.get_children())
                child.destroy();
            strip._appliedSegments = [];
        }

        const segments = [];
        for (const color of spec.colors) {
            const bar = new St.Widget({
                x_expand: true,
                y_expand: true,
            });
            bar.set_style(`background-color: ${color};`);
            strip.add_child(bar);
            segments.push(bar);
        }

        strip._appliedSegments = segments;
        strip._appliedColors = [...spec.colors];
        strip._dockRatios = Array.isArray(spec.ratios) ? [...spec.ratios] : null;
    }

    _positionDockFlagStrip(actor, strip, width, offset) {
        if (!actor || !strip || typeof strip.set_position !== 'function' || typeof strip.set_size !== 'function')
            return;

        const actorWidth = Math.max(0, Math.floor(actor.width ?? actor.get_width?.() ?? 0));
        const actorHeight = Math.max(0, Math.floor(actor.height ?? actor.get_height?.() ?? 0));

        if (actorWidth <= 0 || actorHeight <= 0) {
            if (typeof strip.hide === 'function')
                strip.hide();
            return;
        }

        const safeOffset = Math.max(0, Math.min(offset, actorWidth));
        if (actorWidth <= safeOffset) {
            if (typeof strip.hide === 'function')
                strip.hide();
            return;
        }

        const safeWidth = Math.max(1, Math.min(width, actorWidth - safeOffset));
        if (typeof strip.show === 'function')
            strip.show();

        strip.set_size(safeWidth, actorHeight);
        strip.set_position(actorWidth - safeWidth - safeOffset, 0);

        this._layoutDockFlagSegments(strip, safeWidth, actorHeight);
    }

    _layoutDockFlagSegments(strip, width, height) {
        const segments = strip._appliedSegments;
        if (!Array.isArray(segments) || segments.length === 0)
            return;

        const ratioList = Array.isArray(strip._dockRatios)
            ? strip._dockRatios
            : null;
        const segmentLength = ratioList
            ? ratioList.reduce((total, ratio) => total + ratio, 0)
            : null;
        const hasRatios = Number.isFinite(segmentLength) && segmentLength > 0 &&
            ratioList.length === segments.length;

        const isVertical = strip._dockVertical;
        if (isVertical) {
            let left = 0;
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (!segment || typeof segment.set_position !== 'function')
                    continue;

                const isLast = i === segments.length - 1;
                const delta = hasRatios
                    ? Math.max(1, isLast ? width - left : Math.round(width * (ratioList[i] / segmentLength)))
                    : Math.max(1, isLast
                        ? width - left
                        : Math.floor(width / segments.length));
                segment.set_position(left, 0);
                segment.set_size(delta, height);
                left += delta;
            }

            return;
        }

        let top = 0;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!segment || typeof segment.set_position !== 'function')
                continue;

            const isLast = i === segments.length - 1;
            const delta = hasRatios
                ? Math.max(1, isLast ? height - top : Math.round(height * (ratioList[i] / segmentLength)))
                : Math.max(1, isLast
                    ? height - top
                    : Math.floor(height / segments.length));
            segment.set_position(0, top);
            segment.set_size(width, delta);
            top += delta;
        }
    }

    _restorePanelStyle() {
        if (Main.panel && typeof Main.panel.set_style === 'function')
            Main.panel.set_style(this._panelBaseStyle || null);
    }

    _restoreDockStyle() {
        for (const [actor, base] of this._dockBaseStyleByActor.entries()) {
            if (actor && typeof actor.set_style === 'function')
                actor.set_style(base || null);
        }

        this._dockBaseStyleByActor.clear();
    }

    _restoreDockFlagStrips() {
        for (const strip of this._dockFlagByActor.values()) {
            if (strip && typeof strip.destroy === 'function')
                strip.destroy();
        }

        this._dockFlagByActor.clear();
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

        if (results.length === 0 && Main.overview?.dash) {
            const dash = Main.overview.dash;
            const candidates = [dash?._background, dash?._container, dash?.actor, dash];
            for (const actor of candidates) {
                if (!actor || typeof actor.set_style !== 'function')
                    continue;
                if (!results.includes(actor))
                    results.push(actor);
            }
        }

        return results;
    }

    _isPanelEnabled() {
        return this._settingsBoolean(KEY_PANEL_ENABLED, true);
    }

    _isDockEnabled() {
        return this._settingsBoolean(KEY_DOCK_ENABLED, true);
    }

    _isDockFlagEnabled() {
        return this._settingsBoolean(KEY_DOCK_FLAG_ENABLED, false);
    }

    _dockFlagWidth() {
        const value = this._settingsInt(KEY_DOCK_FLAG_WIDTH, DEFAULT_DOCK_FLAG_WIDTH);
        if (!Number.isFinite(value))
            return DEFAULT_DOCK_FLAG_WIDTH;

        return Math.max(MIN_DOCK_FLAG_WIDTH, Math.min(MAX_DOCK_FLAG_WIDTH, value));
    }

    _dockFlagOffset() {
        const value = this._settingsInt(KEY_DOCK_FLAG_OFFSET, DEFAULT_DOCK_FLAG_OFFSET);
        if (!Number.isFinite(value))
            return DEFAULT_DOCK_FLAG_OFFSET;

        return Math.max(0, Math.min(MAX_DOCK_FLAG_OFFSET, value));
    }

    _colorForLayout(layout) {
        if (layout === 'en') {
            const value = this._settingsString(KEY_COLOR_EN, DEFAULT_COLORS.en)?.trim();
            return value || DEFAULT_COLORS.en;
        }

        if (layout === 'ru') {
            const value = this._settingsString(KEY_COLOR_RU, DEFAULT_COLORS.ru)?.trim();
            return value || DEFAULT_COLORS.ru;
        }

        return null;
    }

    _dockFlagSpecForLayout(layout) {
        if (layout === 'en') {
            return {
                layout: 'en',
                vertical: false,
                colors: ['#002f6c', '#c8102f', '#ffffff', '#c8102f', '#ffffff', '#c8102f'],
                ratios: [6, 10 / 3, 1, 10 / 3, 1, 10 / 3],
                style: [
                    'border-radius: 0 2px 2px 0;',
                    'box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35), inset -1px 0 0 rgba(0,0,0,0.2);'
                ].join(' ')
            };
        }

        if (layout === 'ru') {
            return {
                layout: 'ru',
                vertical: true,
                colors: ['#ffffff', '#005bbb', '#d52b1e'],
                style: [
                    'border-radius: 0 2px 2px 0;',
                    'box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18), inset -1px 0 0 rgba(255,255,255,0.5);'
                ].join(' ')
            };
        }

        return null;
    }

    _settingsBoolean(key, fallback) {
        if (!this._prefsSettings)
            return fallback;

        try {
            return this._prefsSettings.get_boolean(key);
        } catch (_error) {
            return fallback;
        }
    }

    _settingsInt(key, fallback) {
        if (!this._prefsSettings)
            return fallback;

        try {
            return this._prefsSettings.get_int(key);
        } catch (_error) {
            return fallback;
        }
    }

    _settingsString(key, fallback) {
        if (!this._prefsSettings)
            return fallback;

        try {
            return this._prefsSettings.get_string(key);
        } catch (_error) {
            return fallback;
        }
    }
}
