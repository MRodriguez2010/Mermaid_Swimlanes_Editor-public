# HANDOFF.md

## Project

Mermaid Local

Project root:

`./`

## Source of Truth

Primary spec:

- `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

Supporting roadmap/spec files:

- `specs/phase-1-specs.md`
- `specs/phase-2-specs.md`
- `specs/phase-3-specs.md`
- `specs/phase-4-specs.md`
- `specs/phase-5-specs.md`
- `specs/phase-6-specs.md`
- `specs/phase-7-specs.md`
- `planning/product-pivot-roadmap.md`

## Objective

Build a local-first desktop Mermaid editor with:

- Monaco code editing
- Mermaid rendering in an infinite canvas
- bidirectional code/visual editing
- SQLite-backed local snapshots
- file/project management
- templates
- export
- optional AI assistance through Ollama or user-supplied cloud keys

## Current State

The earlier vanilla swimlane editor is complete enough to keep as a Phase 0 prototype. It should be preserved as reference material, not treated as the v1 architecture.

Prototype implemented:

- static three-pane shell
- lane/task state model
- valid Mermaid `timeline` generator
- Mermaid preview with error surface
- lane reorder and task movement
- browser-verified empty-lane and same-lane drag/drop behavior
- browser-verified preview stability and mobile responsiveness

Current state:

- the Tauri/React/TypeScript desktop app has been created and compiles.
- New/Open/Save/Save As were user-verified in the native GUI, including opening `.mmd` and rendering the chart.
- fullscreen exit and the Tauri top/menu surface were user-verified enough to move from Phase 2 to Phase 3.
- Phase 3 snapshot/history baseline is implemented and browser-verified; it still needs a human pass in the native Tauri GUI plus stress validation.
- Phase 4 source-map and visual-editing baseline is started: core AST scanners, editor/source highlighting, rendered SVG click selection, snippets palette, settings panel, theme/direction/layout menus, and basic flowchart visual mutations.
- Phase 5 AI is implemented. Browser-dev mode uses real local Ollama when available and has been programmatically verified through the UI with `qwen2.5-coder:14b` across Generate, Edit, Explain, Convert, Restyle, and Fix. Native Tauri-window Ollama still needs one human GUI smoke. Cloud provider calls remain opt-in and unverified by request.

Phase 1 scaffold implemented:

- React + TypeScript + Vite app
- Tauri 2 config and Rust file command modules
- Monaco Mermaid editor
- Mermaid live preview
- last-good-SVG render error behavior
- file IPC wrappers for open/save/save-as
- browser-dev fallback for `.mmd` open/save/download outside Tauri
- responsive shell with top bar, status bar, canvas region, and AI rail placeholder
- required Tauri icon asset
- canvas drag-pan
- trackpad/wheel panning
- zoom in/out controls
- fit-to-screen
- 100% reset
- fullscreen enter/exit toggle
- zoom indicator
- desktop menu surface grouped as File/Edit/View/Diagram/AI/Help/Settings, with every command wired to an existing action
- layout reset command for persisted panel sizes
- persisted light/dark theme
- persisted resizable editor/canvas/AI layout
- templates bar with 11 built-in Mermaid starters
- editor toolbar for auto-update, manual render, basic format, and docs, with visible action feedback
- cursor-aware status bar
- Rust tests for read/write text-file commands and blank path validation
- whitelisted Tauri external URL command for Mermaid docs
- SQLite/rusqlite local snapshot database
- `documents`, `snapshots`, `settings`, and `recents` schema setup
- zstd-compressed full/diff snapshot storage
- full snapshot every 50 entries by default
- snapshot commands for save, list, content preview, restore, latest document recovery, and pruning
- debounced edit snapshots after 800ms idle
- snapshots for open, save/save-as, manual snapshot, and restore
- startup recovery of latest document content
- history panel opened from the top bar with newest-first timeline, metadata, preview, and restore
- fixed template selection after Phase 3 by preventing latest-snapshot recovery from rerunning on document/template changes
- AST bridge API with `parse(code)` and `applyPatch(code, patch)`
- source maps keyed by AST item id plus line maps keyed by source line
- scanners for flowchart/graph, sequence, class, state, and ER diagrams
- read-only SVG-to-source and source-to-SVG selection sync for mapped elements
- reference-image-inspired snippets palette with draggable/clickable flowchart shape and edge snippets
- selection options toolbar for mapped nodes/edges
- real settings panel for app theme, auto-update, snippets visibility, and layout reset
- canvas diagram theme, direction, and layout menus
- flowchart mutation patches for add node, rename, edit edge label, add edge, delete, reshape, recolor, direction changes, and local layout-hint node dragging
- dropped snippets persist layout hints using the actual canvas drop point
- transformed/moved SVG nodes remain selectable and draggable through surface-level fallback hit testing
- AI rail panel with capability buttons, prompt input, response area, Monaco diff preview, Apply and Cancel controls
- Settings-based AI provider/model/API-key setup
- Ctrl/Cmd+K opens the AI rail and chooses edit mode when text is selected
- Rust AI command surface with canonical prompt, streaming Ollama client, streaming OpenAI client, and streaming Anthropic client
- native AI stream events and request-id cancellation
- native Ollama model discovery through `/api/tags`
- OS keychain-backed AI API-key commands for cloud providers
- SQLite-backed per-document AI history with browser-dev fallback
- Settings has a refreshable installed-model dropdown for Ollama and defaults to installed tags such as `qwen2.5-coder:14b`
- cloud provider calls are opt-in and require a user-supplied key
- browser-dev AI uses real local Ollama for the `ollama` provider when reachable, with deterministic offline fallback only when Ollama is unavailable
- applying an AI proposal creates an immediate `ai` snapshot labeled from the prompt

Verified:

- `npm run check`
- `npm run build:frontend`
- `cargo test` in `src-tauri`
- `cargo check` in `src-tauri`
- `cargo fmt --check` in `src-tauri`
- `npm run dev -- --no-dev-server-wait` compiled and launched `target/debug/mermaid-local`
- Chrome browser verification for editor-to-preview render flow and render-error stability
- Chrome browser verification for template switching, block diagram rendering, theme toggle, AI rail expansion, panel resize, zoom in, fit, 100%, pointer-drag panning, fullscreen enter/exit, auto-update off/manual render, and invalid-code last-good preview preservation
- Chrome CDP verification for top menu labels, AI rail toggle, theme toggle, layout reset, render command, rendered SVG persistence, and no horizontal overflow
- Chrome CDP verification for editor mini-toolbar pointer clicks: auto-update, render, format, docs URL opening, rendered SVG persistence, and no horizontal overflow
- user GUI verification for native file buttons and `.mmd` render
- user GUI verification for fullscreen exit and the Tauri menu/top surface
- Chrome CDP verification for Phase 3 browser-dev snapshot flow: debounced snapshot, manual snapshot, history open/list, preview, restore, rendered SVG persistence, and no horizontal overflow
- Chrome CDP verification for the template regression fix after Phase 4 pointer-event changes
- Chrome CDP verification for Phase 4 selection mapping: SVG click highlights source, Monaco line click outlines SVG node, rendered SVG persists, and no horizontal overflow
- Chrome CDP verification for reference UI gaps: settings panel, snippets insert, selection toolbar, rename, node drag layout hint, recolor, direction change, diagram theme change, connect mode, rendered SVG persistence, and no horizontal overflow
- Strict Chrome CDP app-interface validation for drag/drop snippet placement, transformed-node hit testing, rename, drag, recolor, connect mode, edge snippet drop, direction/theme/settings changes, persisted browser snapshot content, SVG rendering, and no horizontal overflow
- Chrome CDP verification for Phase 5 browser fallback: AI panel open, generate prompt, diff preview, apply, `ai` snapshot, rendered SVG persistence, and no horizontal overflow
- Chrome CDP verification that AI provider/model/API-key setup lives in Settings and no longer appears in the AI rail
- Chrome CDP verification for Phase 5 completion: Settings key fields, AI rail separation, browser fallback stream cancellation, fallback diff/apply, per-document AI history, `ai` snapshot creation, SVG render, and no horizontal overflow
- Chrome CDP verification for local Ollama model dropdown discovery and persisted model selection
- Chrome CDP verification with real local Ollama and UI-selected `qwen2.5-coder:14b`: Generate, Edit, Explain, Convert, Restyle, and Fix completed with non-fallback responses; code-producing features showed diffs, applied, rendered SVG, and created snapshots

## Pivot Summary

The original specs were useful for proving visual editing ideas, but they were too narrow for the end-user app. The updated spec replaces them with a broader product:

- from browser prototype to local desktop app
- from swimlane-only editing to all Mermaid diagram types
- from generated code output to first-class Monaco editing
- from simple preview to infinite pan/zoom canvas
- from finite/manual history to SQLite snapshots for every edit
- from future collaboration ideas to local-first privacy, export, templates, and AI

## Immediate Next Action

1. Read `specs/MERMAID_LOCAL_UPDATED_SPEC.md`.
2. Read `specs/phase-6-specs.md` and `planning/product-pivot-roadmap.md`.
3. Run `npm run dev` in an interactive desktop session.
4. Continue Phase 6: export, command palette, shortcut hardening, crash-recovery polish, performance work, and release hardening.
5. Verify native Tauri-window Ollama once in the desktop GUI; browser-dev real-Ollama UI is already programmatically verified.
6. Keep the Phase 3/4 native validation and stress passes as deferred polish.
7. Defer OpenAI/Anthropic verification until the user explicitly opts into using those keys.

## Pending

- Phase 6: export dialog, SVG/PNG/PDF/Mermaid/Markdown export, copy-as commands, command palette, keyboard shortcut customization, crash recovery polish, file watcher reload prompts, recent files/projects, app packaging, performance tests, and release docs.
- Native desktop validation: Phase 3 snapshot/history workflow, native Tauri-window Ollama GUI pass, and Phase 3 1000-snapshot stress/performance checks.
- Phase 4 polish: inline edit overlays, connection handles, richer edge styling, non-flowchart mutation UX, and broader scanner/mutation tests.
- Cloud AI verification: OpenAI and Anthropic streaming calls with real user-supplied keys.
- Performance/build polish: Vite large chunk warnings from Mermaid/Monaco should be addressed with dynamic imports or chunking during Phase 6.

## Important Constraints

- Local-first by default.
- No telemetry or analytics.
- Cloud AI must be opt-in and use user-supplied keys only.
- Use official Mermaid rendering/parsing APIs; do not reimplement Mermaid.
- Store API keys in the OS keychain, never raw SQLite/settings text.
- Use SQLite for snapshots, settings, recents, templates, and AI history.
- Preserve file compatibility: native diagram files are plain `.mmd`.

## Existing Prototype Commands

Serve the current prototype:

```bash
cd ./
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/index.html
```

## One-Line Resume Instruction

Resume build on `./`. Treat `specs/MERMAID_LOCAL_UPDATED_SPEC.md` as the source of truth. Phase 1 scaffold is built, browser-verified, Rust-checked, Tauri dev compiles/launches, and native New/Open/Save/Save As were user-verified. Phase 2 includes templates, theme, persisted resizable layout, AI rail, editor toolbar, cursor-aware status bar, browser-verified canvas pan/zoom/fit/100/fullscreen enter-exit, Rust file-command tests, a wired File/Edit/View/Diagram/AI/Help/Settings top surface, and user-verified fullscreen/menu behavior. Phase 3 baseline includes SQLite/rusqlite snapshots, zstd compression, full/diff chains, debounced/open/save/manual/restore triggers, history preview/restore UI, latest-document recovery, and fixed template selection. Phase 4 baseline includes AST/source-map scaffolding, core diagram scanners, Monaco/SVG selection sync, snippets palette, settings panel, diagram theme/direction/layout menus, flowchart add/rename/reshape/recolor/delete/connect, and node drag persisted as local layout hints. Phase 5 includes Settings-based AI provider/model/API-key setup, OS keychain-backed cloud keys, streaming Ollama/OpenAI/Anthropic command paths, cancellation, browser-dev real-Ollama execution with offline fallback, Monaco diff review, per-document SQLite AI history, apply/cancel, Ctrl/Cmd+K opening, and AI snapshots on apply. Continue Phase 6 export/settings/command-palette/shortcuts/performance/release work; keep native Phase 3/4 validation, native Tauri-window Ollama GUI validation, and cloud-provider verification as deferred polish.
