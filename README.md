# Mermaid Local

**Employee Sentiment Analysis project family:** [Project guide](https://github.com/MRodriguez2010/Revelio/blob/main/docs/employee-sentiment-analysis-projects.md) · [Revelio interactive demo](https://github.com/MRodriguez2010/Revelio)

The standalone editor and its browser prototype are included. The bundled diagrams illustrate a fictional supply workflow.

Local-first desktop editor for authoring Mermaid diagrams with a code editor, infinite canvas, bidirectional visual editing, local history, export, and optional AI assistance.

The project directory is still named `Mermaid_Swimlanes_Editor`, but the product direction has pivoted. The updated source of truth is:

- `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Product Direction

The earlier app was a narrow vanilla-JS swimlane/task editor. That work is now treated as a Phase 0 prototype: it proved local Mermaid rendering, state-driven UI updates, drag/drop behavior, and preview synchronization. It should not be expanded into the v1 architecture except as reference material.

The v1 target is a desktop application:

- Tauri 2.x shell with Rust backend
- React 18 + TypeScript frontend
- Monaco Editor with Mermaid language support
- Mermaid v11+ renderer
- Infinite pan/zoom SVG canvas
- AST bridge for code-to-canvas and canvas-to-code sync
- SQLite-backed local snapshots and settings
- Local AI via Ollama, with opt-in BYO-key Anthropic/OpenAI providers
- Export to SVG, PNG, PDF, Mermaid, Markdown, and clipboard

## Roadmap

Phase 0 is complete as a browser prototype. Forward development should follow the updated phase specs:

1. `specs/phase-1-specs.md` - Tauri/React skeleton, Monaco, live Mermaid preview, basic file open/save.
2. `specs/phase-2-specs.md` - resizable app shell, infinite canvas, templates, theme, status bar.
3. `specs/phase-3-specs.md` - SQLite snapshot system, timeline UI, restore flow.
4. `specs/phase-4-specs.md` - AST bridge and bidirectional visual editing.
5. `specs/phase-5-specs.md` - AI panel, Ollama, cloud providers, streaming diff/apply flow.
6. `specs/phase-6-specs.md` - export, settings, keyboard shortcuts, performance, release hardening.
7. `specs/phase-7-specs.md` - post-v1 stretch items.

Planning notes live in `planning/`. Start with `planning/product-pivot-roadmap.md`.

## Current Prototype

Implemented and browser-verified:

- three-pane static browser shell
- lane/task board for a timeline-style diagram
- valid Mermaid `timeline` generation
- code and preview synchronization
- lane reorder, same-lane task reorder, and empty-lane task drops
- preview recovery after rapid title edits
- 390px mobile viewport with no horizontal overflow

## Current Desktop App

Phase 1 and Phase 2 are implemented; the Phase 3 snapshot baseline is implemented; Phase 4 source-map/visual editing is underway; Phase 5 AI integration is implemented enough to move on to Phase 6:

- React + TypeScript + Vite scaffold
- Tauri 2 project files and Rust command stubs
- Monaco Mermaid editor
- Mermaid v11 render path
- last-good-SVG behavior on render errors
- top bar, status bar, canvas region, and collapsible AI rail
- typed frontend file IPC wrappers for `.mmd` open/save/save-as
- Rust file read/write commands
- persisted light/dark theme and panel layout
- resizable editor/canvas/AI workspace
- template strip with 11 built-in Mermaid starters, including block/architecture
- editor tools for auto-update, manual render, docs, and basic formatting
- canvas pan tool, drag/trackpad panning, zoom, fit, 100%, fullscreen enter/exit
- status bar cursor position, diagram type, save state, render state, and snapshot placeholder
- desktop top surface grouped as File/Edit/View/Diagram/AI/Help/Settings with wired commands only
- layout reset command for persisted panel sizing
- Rust tests for text-file read/write commands and blank path validation
- SQLite/rusqlite snapshot database with `documents`, `snapshots`, `settings`, and `recents`
- zstd-compressed full/diff snapshots, with a full snapshot every 50 entries by default
- snapshot commands for save, list, preview content, restore, latest document recovery, and pruning
- debounced edit snapshots after 800ms idle
- snapshots for open, save/save-as, manual snapshot, and restore
- history panel with newest-first entries, metadata, read-only preview, and restore
- startup recovery of the latest document from snapshot storage
- fixed template selection after snapshot recovery by making recovery mount-only
- AST/source-map bridge scaffold
- scanners for flowchart/graph, sequence, class, state, and ER diagrams
- Monaco source highlighting for selected AST spans
- rendered SVG click selection for mapped elements
- Monaco line click to mapped SVG outline for supported flowchart elements
- snippets palette with flowchart shapes and edges
- selection toolbar with rename, shape, color, connect, duplicate, and delete actions
- settings panel with theme, auto-update, snippets, and layout reset controls
- diagram theme, direction, and layout canvas menus
- basic flowchart visual edits, including node drag persisted as local layout hints
- drag/dropped snippets persist a local layout hint from the canvas drop point
- moved nodes remain selectable/draggable after SVG transforms are applied
- AI panel with capability buttons, prompt input, response area, Monaco diff preview, and apply/cancel controls
- Settings-based AI provider/model/API-key setup
- Rust AI command for Ollama, OpenAI, and Anthropic, with streaming events and request-id cancellation
- refreshable Ollama installed-model dropdown backed by `/api/tags`
- OS keychain-backed API-key commands for cloud providers
- per-document AI history persisted through SQLite in native mode
- browser-dev AI uses real local Ollama for the Ollama provider when available, with deterministic fallback for offline smoke checks
- Ctrl/Cmd+K opens the AI rail
- applying an AI proposal records an immediate `ai` snapshot labeled from the prompt

Verified in this environment:

- `npm run check`
- `npm run build:frontend`
- `cargo test` in `src-tauri`
- `cargo check` in `src-tauri`
- `npm run dev -- --no-dev-server-wait` compiled the Tauri app and launched `target/debug/mermaid-local`
- browser check for initial render, Monaco edit -> Mermaid rerender, invalid-code error display, last-good preview preservation, and no default viewport overflow
- browser check for template switching, block diagram rendering, theme toggle, AI rail expand, panel resize, canvas zoom/fit/100%, pointer-drag panning, fullscreen enter/exit, manual render with auto-update off, and invalid-code last-good preview preservation
- browser CDP check for top menu labels, AI rail toggle, theme toggle, layout reset, render command, rendered SVG persistence, and no horizontal overflow
- user GUI verification that New, Open, Save, and Save As work in the native app, including opening `.mmd` and rendering the chart
- user GUI verification that fullscreen exit and the Tauri top/menu surface work
- browser CDP check for Phase 3 snapshots: debounced snapshot, manual snapshot, history open/list, preview, restore, rendered SVG persistence, and no horizontal overflow
- browser CDP check for the template regression fix after source-map pointer-event changes
- browser CDP check for Phase 4 selection sync: canvas click highlights source, editor line click outlines SVG, rendered SVG persists, and no horizontal overflow
- browser CDP check for snippets, settings, selection options, rename, drag layout hints, recolor, direction/theme menus, connect mode, rendered SVG persistence, and no horizontal overflow
- strict browser CDP validation for drag/drop snippet placement, transformed-node hit testing, edge snippet drop, persisted snapshot content, rendered SVG persistence, and no horizontal overflow
- browser CDP check for Phase 5 browser fallback: AI panel open, generate prompt, diff preview, apply, `ai` snapshot, rendered SVG persistence, and no horizontal overflow
- browser CDP check that AI provider/model/API-key setup lives in Settings and no longer appears in the AI rail
- browser CDP check for Phase 5 completion: Settings key fields, AI rail separation, browser fallback stream cancellation, fallback diff/apply, per-document AI history, `ai` snapshot creation, SVG render, and no horizontal overflow
- browser CDP check for local Ollama model dropdown discovery and persisted model selection
- browser CDP check with real local Ollama and UI-selected `qwen2.5-coder:14b`: Generate, Edit, Explain, Convert, Restyle, and Fix completed; code-producing features showed diffs, applied, rendered SVG, and created snapshots

Not yet verified here:

- the Phase 3 snapshot/history workflow in the interactive Tauri desktop window.
- the Phase 3 1000-snapshot stress/performance exit criteria.
- Phase 4 polish: inline edit overlays, connection handles, richer edge styling, and mutation support beyond flowcharts.
- native Tauri-window Ollama GUI smoke; browser-dev real-Ollama UI has been programmatically verified with `qwen2.5-coder:14b`.
- cloud provider calls with real OpenAI/Anthropic keys.
- browser-dev AI history/API-key fallback uses localStorage because browser mode has no native keychain/SQLite access.

Pending Phase 6 work:

- export and copy-as workflows for SVG, PNG, PDF, Mermaid, and Markdown
- command palette and keyboard shortcut customization
- crash recovery polish, file watcher reload prompts, and recent files/projects
- packaging for macOS, Windows, and Linux
- performance suite and large-bundle/chunking cleanup
- release documentation for install, first run, privacy, AI setup, export, and troubleshooting

Run the prototype:

```bash
cd ./
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/index.html
```

## Next Build Step

Run the native dev app:

```bash
npm run dev
```

Then verify in the desktop window:

- open `.mmd`
- edit in Monaco
- live preview updates
- save
- reopen saved file
- render error keeps last successful SVG
- drag the canvas to pan
- use zoom, fit, 100%, and fullscreen controls
- wait for an edit snapshot, create a manual snapshot, open history, preview an entry, restore it, quit, and confirm latest content recovers on restart
- open AI, run a prompt, review the diff, apply it, and confirm an `ai` snapshot appears
- after that, continue Phase 6 export, command palette, shortcuts, crash recovery, performance, packaging, and docs

Do not preserve the old "no dependencies beyond Mermaid.js" constraint. The updated spec intentionally chooses Tauri, React, Monaco, pan/zoom, Zustand, SQLite, and Rust backend modules because those produce the most useful end-user app.

## End-User AI Setup Target

The README for the v1 app should eventually include:

```bash
ollama pull qwen2.5-coder
ollama serve
```

Then in the app: Settings > AI > Provider: Ollama.

Cloud AI must remain opt-in with user-supplied keys only.

## Historical source examples

Open the [benchmark review diagram](public-data/benchmark-review.mmd) to see how the State Street, Trihydro and Caliber Collision examples move from an archived comparison through validation to a neutral table.
