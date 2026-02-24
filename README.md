# Layout Panel Color Live

English: [Jump to English](#english)

Расширение для GNOME, которое в зависимости от `EN/RU` раскладки, меняет внешний вид рабочего окружения: цвет верхней панели, цвет Ubuntu Dock (панель приложений), выводит небольшой стилизованный флаг у края dock.

## Подробнее о расширении

`Layout Panel Color Live` автоматически меняет оформление интерфейса GNOME по текущей раскладке клавиатуры:

- если включена EN — применяется один цвет панели (задаётся в настройках);
- если включена RU — применяется другой цвет панели (задаётся в настройках);
- кроме цвета (если включено в настройках) справа на панели выводится стилизованный флажок;
- позволяет настроить изменение цвета верхней панели и/или Ubuntu Dock.

## Для кого это полезно

- Тем, кто часто переключается между EN/RU и хочет быстро видеть активную раскладку глазами - цвет и флажок более нагляден и позволяет совершать меньше ошибок из-за неправильно включенной раскладки клавиатуры.
- Тем, кто любит настраивать рабочее окружение под себя.
- Тем, кто хочет аккуратный визуальный маркер состояния системы без тяжёлых скриптов.

## Установка

### Локальная установка (из исходников)

```bash
cd ~/layout-panel-color-live-extension
mkdir -p ~/.local/share/gnome-shell/extensions/layout-panel-color-live@azabolo.github.io
cp -a ./* ~/.local/share/gnome-shell/extensions/layout-panel-color-live@azabolo.github.io/

glib-compile-schemas ~/.local/share/gnome-shell/extensions/layout-panel-color-live@azabolo.github.io/schemas

gnome-extensions disable layout-panel-color-live@azabolo.github.io || true
gnome-extensions enable layout-panel-color-live@azabolo.github.io
```

### Проверка после установки

```bash
gnome-extensions list | rg layout-panel-color-live
journalctl -b | rg "layout-panel-color-live"
```

### Быстрая настройка

```bash
gnome-extensions prefs layout-panel-color-live@azabolo.github.io
```

## Настройки и параметры

- `panel-enabled`: включение/выключение окраски верхней панели.
- `dock-enabled`: включение/выключение окраски Dock.
- `color-en`: цвет для EN.
- `color-ru`: цвет для RU.
- `dock-flag-enabled`: включение/выключение флага.
- `dock-flag-width`: ширина флага (по умолчанию 12, диапазон 2–64 px).
- `dock-flag-offset`: отступ от правой кромки Dock (по умолчанию 0, диапазон 0–64 px).

## Безопасность и совместимость

- Работает поверх стандартного API GNOME Shell (`St`, `Gio`, `GLib`) без сторонних сервисов.
- Версия расширения и настройки ориентированы на GNOME Shell 46+.

## Поддержка

Если нашли баг или хотите предложить идею — откройте issue с:
- версией GNOME,
- версией расширения,
- шагами воспроизведения,
- фрагментом логов (`journalctl`).

## Ключи для поиска

GNOME, GNOME Shell, Gnome Extensions, ubuntu dock, dock color, top panel color, keyboard layout indicator, layout switch, EN RU, punto switcher, русская раскладка, английская раскладка, extension preferences, panel coloring, dock strip, dynamic theme effect.

---

## English

`Layout Panel Color Live` changes GNOME appearance depending on the active EN/RU keyboard layout: top panel color, Ubuntu Dock (application panel) color, and shows a small stylized flag near the dock edge.

### About the extension

`Layout Panel Color Live` automatically adjusts the GNOME interface based on the current keyboard layout:

- when EN is active, one panel color is applied (configured in settings);
- when RU is active, another panel color is applied (configured in settings);
- besides color (if enabled in settings), a stylized flag is shown on the right side of the panel;
- you can enable color changes for the top panel and/or Ubuntu Dock.

### Who is this for

- People who frequently switch between EN/RU and want to quickly see the active layout visually; the color and flag make it easier to avoid errors from the wrong keyboard layout.
- People who like to customize their desktop environment to their preferences.
- People who want a clean visual state marker without heavy scripts.

### Installation

### Local installation (from source)

```bash
cd ~/layout-panel-color-live-extension
mkdir -p ~/.local/share/gnome-shell/extensions/layout-panel-color-live@azabolo.github.io
cp -a ./* ~/.local/share/gnome-shell/extensions/layout-panel-color-live@azabolo.github.io/

glib-compile-schemas ~/.local/share/gnome-shell/extensions/layout-panel-color-live@azabolo.github.io/schemas

gnome-extensions disable layout-panel-color-live@azabolo.github.io || true
gnome-extensions enable layout-panel-color-live@azabolo.github.io
```

### Open preferences

```bash
gnome-extensions prefs layout-panel-color-live@azabolo.github.io
```

### Settings and parameters

- `panel-enabled`: enable/disable top panel coloring.
- `dock-enabled`: enable/disable Dock coloring.
- `color-en`: color for EN.
- `color-ru`: color for RU.
- `dock-flag-enabled`: enable/disable the flag.
- `dock-flag-width`: flag width (default 12, range 2–64 px).
- `dock-flag-offset`: offset from the right edge of Dock (default 0, range 0–64 px).

### Security and compatibility

- Works on top of the standard GNOME Shell API (`St`, `Gio`, `GLib`) without third-party services.
- Extension version and settings are aimed at GNOME Shell 46+.

### Support

If you found a bug or want to suggest an idea, open an issue with:
- GNOME version,
- extension version,
- reproduction steps,
- relevant logs (`journalctl`).

### Search keywords

GNOME, GNOME Shell, Gnome Extensions, ubuntu dock, dock color, top panel color, keyboard layout indicator, layout switch, EN RU, punto switcher, Russian layout, English layout, extension preferences, panel coloring, dock strip, dynamic theme effect.
