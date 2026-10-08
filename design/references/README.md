# Design references

Approved Claude design mockups for Stride, organized so implementation and planning agents can find the right reference for a screen.

## Rules

- Everything under `design/references/**` is read-only. Never edit, recompress, recreate, or ship these files as application assets.
- **Screenshots (`screenshots/*.png`) are the visual source of truth.** They are original-resolution exports.
- **HTML ZIP exports (`source/*.zip`) are structural references only.** They help explain layout, hierarchy, and states. Generated markup, styles, and scripts must never be copied into production. Rebuild with Stride's architecture, Tailwind, Night Track tokens, and shadcn primitives.
- If a screenshot and its export disagree, the screenshot wins.

## Layout

```
design/references/
├── manifest.json
├── README.md
└── <area>/<screen>/
    ├── screenshots/<name>.png
    └── source/<name>.zip
```

Areas: `system`, `auth`, `onboarding`, `app`, `settings`.

A screenshot and its export share the same `<name>` inside the same screen folder, so `screenshots/mobile.png` is paired with `source/mobile.zip`. `manifest.json` lists every pair together with the original export filenames and match confidence.

## Naming conventions

- Folder and file names are English kebab-case.
- Default state: the file is named after the device: `desktop`, `mobile`.
- Other states: `<state>-<device>`, for example `mfa-desktop`, `error-invalid-credentials-mobile`, `light-theme-mobile`.
- Boards that are not a device screen use `board` (system) or the state name alone (`state-model`).
- Device variants that do not exist are not created. `approve-change` and `today/light-theme` are mobile only; `settings/account-menu` is desktop only.
- Folder names describe the design screen. They are not route names and do not imply application routes.

## Inspecting a ZIP export

Extract into a temporary directory outside the repository, never into `design/`:

```bash
mkdir -p /tmp/stride-ref && cd /tmp/stride-ref
python3 -m zipfile -e /srv/projects/Stride/design/references/<area>/<screen>/source/<name>.zip .
```

Read the extracted files, then delete the directory. Do not commit extracted contents.

## Manifest

`manifest.json` entries contain `id`, `area`, `screen`, `state`, `device`, `screenshot_path`, `html_reference_path`, `original_screenshot_name`, `original_export_name`, `matched_confidence` (`exact`, `high`, or `uncertain`), and `notes`. Anything not confidently matched is listed under `unresolved`.
