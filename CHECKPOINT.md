# CHECKPOINT

Last updated: 2026-05-02

## Project

Mermaid Local

Working directory:

`./`

## Current State

- Product direction has pivoted from the original swimlane-board prototype to the updated `Mermaid Local` desktop specification.
- New source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`.
- The existing vanilla HTML/CSS/JS app remains useful as a Phase 0 prototype and validation spike.
- Phase 1 Tauri/React/TypeScript scaffold now exists.
- Frontend checks, Rust checks, and browser verification pass.
- Rust toolchain was installed with `rustup` during this session.
- Tauri dev compile reaches `target/debug/mermaid-local`.
- User verified the native GUI New/Open/Save/Save As buttons work, including opening `.mmd` and rendering the chart.
- Phase 2 is complete enough to move on: persisted resizable panels, templates, light/dark theme, editor mini-toolbar with visible action feedback, AI rail, cursor-aware status bar, canvas pan/zoom/fit/100%/fullscreen enter-exit, desktop menu surface, and layout reset are implemented.
- Rust file command tests now cover read/write round trips and blank path rejection.
- The editor mini-toolbar click issue reported by the user was fixed by raising/stabilizing the overlay, adding feedback, and opening docs through a whitelisted Tauri command.
- The fullscreen bug reported by the user was fixed in code, browser-verified, and user-verified in the native Tauri window.
- The Tauri menu/top surface was user-verified enough to move past Phase 2.
- Phase 3 baseline is implemented: SQLite/rusqlite snapshot storage, zstd compression, full/diff snapshot chains, manual/debounced/open/save/restore triggers, startup latest-document recovery, and a history panel with preview/restore.
- A template-selection regression introduced during Phase 3 was fixed by making startup snapshot recovery mount-only and by explicitly refreshing preview/history state on template selection.
- Phase 4 first slice is implemented: AST/source-map scaffolding, scanners for core diagram types, Monaco source highlighting, rendered SVG click selection, snippets palette, selection options toolbar, diagram theme/direction/layout menus, settings panel, and basic flowchart visual mutations.
- Reference images were added in `specs/images/` and used to reshape the Phase 4 UI: `main_UI.png`, `code_snippets.png`, `entity_options.png`, `menu_UI.png`, `theme.png`, `layout.png`, and `change_direction.png`.
- Phase 5 is implemented enough to move on: AI rail panel, Settings-based provider/model/API-key setup, OS keychain-backed cloud keys, prompt/capability flow, native streaming AI command paths for Ollama/OpenAI/Anthropic, browser-dev real-Ollama execution with offline fallback, stream cancellation, Monaco diff preview, response copy, apply/cancel, Ctrl/Cmd+K open flow, per-document SQLite AI history, and AI-labeled snapshots on apply.
- Real local Ollama was programmatically verified through the UI with the selected `qwen2.5-coder:14b` model for Generate, Edit, Explain, Convert, Restyle, and Fix.

## Spec Comparison

Original specs emphasized:

- a dependency-light browser app
- swimlane/section editing only
- lane/task state as the main data model
- Mermaid output as generated code from a custom board UI
- later styling/export/collaboration ideas

Updated spec emphasizes:

- a full local desktop application
- any Mermaid diagram type, not only swimlane/timeline diagrams
- code-first editing with Monaco plus visual canvas editing
- official Mermaid rendering and parser APIs
- AST/source-map bridge for bidirectional sync
- SQLite snapshots for every edit
- file/project management, templates, export, settings, keyboard shortcuts
- local AI via Ollama and opt-in BYO-key cloud AI
- no telemetry and strict local-first privacy guarantees

Decision: stop expanding the old swimlane app except for preservation or regression checks. Build the end-user product described by the updated spec.

## Existing Prototype Status

Implemented files:

- `index.html`
- `styles/app.css`
- `src/main.js`
- `src/state.js`
- `src/codegen.js`
- `src/render-board.js`
- `src/drag.js`
- `src/preview.js`
- `src/utils.js`

Verified prototype behavior:

- valid Mermaid `timeline` output with lane `section` groups
- code and preview sync from board state
- lane drag/drop updates board, code, and preview
- same-lane task drag/drop updates board, code, and preview
- empty-lane fallback output remains valid
- dragging into an empty lane removes empty state and syncs outputs
- rapid title updates recover to stable preview
- 390px mobile viewport has no horizontal overflow

Verification commands previously run:

- `node --check` for all existing source modules
- state/codegen smoke check
- local Chrome DevTools browser verification

## New Phase Plan

1. Phase 1 - Tauri + React + Vite skeleton, Monaco, Mermaid preview, basic file open/save.
2. Phase 2 - resizable app shell, infinite canvas, templates, light/dark theme, status bar.
3. Phase 3 - SQLite snapshot system, history timeline, thumbnails, restore.
4. Phase 4 - AST bridge and bidirectional visual editing for core diagram types.
5. Phase 5 - AI panel with Ollama, Anthropic, OpenAI, streaming diff/apply flow.
6. Phase 6 - export, settings, command palette, shortcuts, crash recovery, performance and release hardening.
7. Phase 7 - post-v1 stretch features.

## Immediate Next Slice

Move to Phase 6 from `specs/phase-6-specs.md`:

1. Add export, command palette, shortcut hardening, crash-recovery polish, performance work, and release hardening.
2. Run one native Tauri-window Ollama GUI smoke; browser-dev real-Ollama UI is already verified against local `/api/generate`.
3. Keep Phase 3/4 native validation and stress passes on the polish list.
4. Keep cloud-provider verification deferred until the user opts into OpenAI/Anthropic keys.

## New Session Resume Prompt

Resume build on `./`. Read `CHECKPOINT.md`, `HANDOFF.md`, `README.md`, `specs/MERMAID_LOCAL_UPDATED_SPEC.md`, and `specs/phase-6-specs.md` first. Phase 1 is implemented, browser-verified, Rust-checked, and native New/Open/Save/Save As were user-verified. Phase 2 has templates, persisted light/dark theme, persisted resizable layout, AI rail, editor toolbar, cursor-aware status bar, browser-verified canvas pan/zoom/fit/100/fullscreen enter-exit, Rust file-command tests, a wired File/Edit/View/Diagram/AI/Help/Settings top surface, and user-verified fullscreen/menu behavior. Phase 3 baseline is implemented with SQLite/rusqlite snapshots, zstd compression, full/diff restore chains, history preview/restore UI, manual/debounced/open/save/restore triggers, startup latest-document recovery, and a fixed template-selection recovery regression. Phase 4 has AST/source-map scaffolding, core scanners, Monaco/SVG selection sync, snippets palette, selection options toolbar, settings panel, diagram theme/direction/layout menus, flowchart add/rename/reshape/recolor/delete/connect, and node drag persisted as local layout hints. Phase 5 has Settings-based provider/model/API-key setup, OS keychain-backed cloud keys, streaming Ollama/OpenAI/Anthropic command paths, browser-dev real-Ollama execution with offline fallback, cancellation, response copy, robust Mermaid proposal extraction, Monaco diff review, per-document SQLite AI history, apply/cancel flow, Ctrl/Cmd+K opening, and AI snapshots on apply. Real local Ollama was programmatically verified through the UI with `qwen2.5-coder:14b` across all six AI capabilities. Continue Phase 6 export/settings/command-palette/shortcuts/performance/release work, while keeping native Phase 3/4 validation, native Tauri-window Ollama GUI validation, and cloud-provider verification as deferred polish.

## Phase 1 Code Progress

Created:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/components/Editor/CodeEditor.tsx`
- `src/components/Canvas/MermaidCanvas.tsx`
- `src/components/AI/AiPanel.tsx`
- `src/components/Toolbar/TopBar.tsx`
- `src/components/StatusBar/StatusBar.tsx`
- `src/components/TemplatesBar/TemplatesBar.tsx`
- `src/components/Settings/SettingsPanel.tsx`
- `src/components/VisualEditing/SelectionToolbar.tsx`
- `src/components/VisualEditing/SnippetsPanel.tsx`
- `src/ast/index.ts`
- `src/ast/parse.ts`
- `src/ast/apply.ts`
- `src/ast/layoutHints.ts`
- `src/ast/types.ts`
- `src/ast/scanners/flowchart.ts`
- `src/ast/scanners/sequence.ts`
- `src/ast/scanners/class.ts`
- `src/ast/scanners/state.ts`
- `src/ast/scanners/er.ts`
- `src/data/templates.ts`
- `src/hooks/usePersistentState.ts`
- `src/ipc/files.ts`
- `src/ipc/ai.ts`
- `src/lang/mermaid-monarch.ts`
- `src/store/document.ts`
- `src/styles/app.css`
- `src-tauri/`
- `src-tauri/src/ai/prompts.rs`
- `src-tauri/src/commands/ai.rs`
- `prototype/index.html`

Implemented:

- React/Vite app shell
- Monaco editor with Mermaid language registration
- Mermaid render flow with 150ms debounce
- last-good-SVG preservation on parse/render errors
- status bar with file path, diagram type, modified state, render state, snapshot placeholder
- status bar cursor position
- top bar with new/open/save/save-as actions
- editor toolbar for auto-update, manual render, basic format, and docs
- Tauri dialog + command wrappers for `.mmd` file operations
- Rust read/write text-file commands
- Rust tests for text-file read/write commands and blank path validation
- whitelisted external URL command for Mermaid docs
- responsive fallback to avoid default viewport overflow
- browser-dev fallback for `.mmd` open/save/download when not running inside Tauri
- visible app-level error surface for file workflow failures
- required Tauri RGBA icon asset
- persisted light/dark theme and layout state
- resizable editor/canvas/AI workspace
- templates bar with 11 starters across flowchart, sequence, class, state, ER, timeline, gantt, mindmap, pie, and block/architecture
- canvas pan tool, drag panning, wheel/trackpad panning, zoom controls, fit, 100%, and fullscreen enter/exit
- desktop top surface grouped as File/Edit/View/Diagram/AI/Help/Settings with only wired commands
- layout reset command for returning persisted panel sizes to defaults
- editor mini-toolbar feedback for auto-update, render, format, and docs actions
- SQLite snapshot database initialized through `rusqlite`
- `documents`, `snapshots`, `settings`, and `recents` tables
- zstd-compressed snapshot payloads
- full snapshot every 50 entries with compressed diff snapshots between full entries
- snapshot commands for save, list, content preview, restore, latest document recovery, and pruning
- frontend snapshot IPC wrappers with browser-dev localStorage fallback
- debounced edit snapshots after 800ms idle
- snapshots on file open, file save/save-as, manual snapshot, and restore
- startup recovery of the latest document from local snapshot storage
- history panel opened from the top bar, with newest-first entries, metadata, read-only preview, and restore
- mount-only snapshot recovery so document/template changes are not overwritten by latest-document recovery
- AST bridge API with `parse(code)` and `applyPatch(code, patch)`
- source maps keyed by AST item id and line maps keyed by source line
- regex-assisted scanners for flowchart/graph, sequence, class, state, and ER diagrams
- read-only SVG-to-source selection sync for mapped rendered elements
- Monaco line-to-SVG selection sync for mapped source lines
- snippets panel with draggable/clickable flowchart shape and edge snippets
- selection toolbar for mapped entities with rename, shape, color, connect, duplicate, and delete actions
- settings panel with app theme, auto-update, snippets visibility, and reset-layout controls
- canvas theme popover, direction menu, and layout menu modeled after the reference screenshots
- flowchart visual mutations through `applyPatch`: add node, rename node, edit edge label, add edge, delete node, delete edge, change shape, recolor node, set direction, and move node
- node dragging writes a `%% mermaid-local-layout: ... %%` local comment and reapplies SVG transforms after render
- dropped snippets now persist a layout hint from the actual canvas drop point
- moved/transformed SVG nodes use surface-level fallback hit testing, so they remain selectable and draggable after layout hints are applied
- AI rail panel with capability buttons for generate, fix, edit, explain, convert, and restyle
- Settings-based provider/model controls for Ollama, OpenAI, and Anthropic
- Settings-based API-key field that appears only for cloud providers
- native `run_ai_request` command with canonical prompt, streaming local Ollama request path, and opt-in streaming cloud request paths
- native AI stream events for start, chunk, done, cancellation, and provider errors
- native `cancel_ai_request` command with request-id cancellation checks during provider streams
- native `list_ollama_models` command backed by `http://localhost:11434/api/tags`
- AI response extraction recognizes fenced Mermaid with frontmatter so Ollama restyle output becomes an applyable diff
- AI response extraction also recognizes prefaced fenced Mermaid blocks, which is common in local model output
- AI response panel includes a Copy button with clipboard fallback
- OS keychain-backed AI API-key commands for saving, reading, and deleting cloud provider keys
- SQLite-backed per-document AI history commands with browser-dev localStorage fallback
- Settings uses a refreshable dropdown for installed Ollama models and auto-corrects the old `qwen2.5-coder` default to an installed tag such as `qwen2.5-coder:14b`
- browser-dev AI uses real local Ollama for the `ollama` provider when reachable, then falls back to deterministic offline responses only if Ollama is unavailable
- response area, Monaco diff preview, Apply and Cancel controls
- Ctrl/Cmd+K opens the AI rail and switches to edit mode when editor text is selected
- applying an AI proposal updates the document, refreshes preview, and creates an immediate `ai` snapshot labeled from the prompt

Verified:

- `npm run check`
- `npm run build:frontend`
- `cargo test` in `src-tauri`
- `cargo check` in `src-tauri`
- `cargo fmt --check` in `src-tauri`
- `npm run dev -- --no-dev-server-wait`, which compiled and launched `target/debug/mermaid-local`
- user GUI pass for New/Open/Save/Save As and `.mmd` render
- Chrome browser verification of:
  - initial Monaco + Mermaid render
  - editor content update to `sequenceDiagram`
  - status diagram-type update
  - invalid Mermaid error surface
  - last good SVG remains visible after invalid code
  - no horizontal overflow at default browser viewport
  - template switching and block diagram rendering
  - theme toggle
  - AI rail expansion
  - panel resize
  - zoom in, fit, 100%, pointer-drag canvas panning, and fullscreen enter/exit
  - manual render while auto-update is off
  - top menu labels, AI rail toggle, theme toggle, layout reset, render command, rendered SVG persistence, and no horizontal overflow via Chrome CDP
  - editor mini-toolbar pointer clicks for auto-update, render, format, docs URL opening, rendered SVG persistence, and no horizontal overflow via Chrome CDP
  - Phase 3 browser-dev snapshot flow: debounced snapshot, manual snapshot, history open/list, preview, restore, rendered SVG persistence, and no horizontal overflow via Chrome CDP
  - template regression smoke after the Phase 3 recovery fix: template selection, snapshot recording, history open/list, SVG render, and no overflow
  - Phase 4 selection smoke: mapped flowchart SVG elements, canvas click to source highlight, Monaco line click to SVG outline, SVG render, and no overflow
  - visual-editing smoke: settings panel open/close, snippets node insert, selection toolbar, rename, node drag layout hint, recolor, direction change, diagram theme change, SVG render, and no overflow
  - connection smoke: select source node, click connect, select target node, appended edge renders with no app error
  - strict app-interface smoke: drag/drop snippet placement, transformed-node hit testing, rename, drag, recolor, connect mode, edge snippet drop, direction change, settings dark mode, diagram theme change, persisted browser snapshot content, SVG render, and no horizontal overflow
  - Phase 5 browser-dev AI smoke: open AI panel, generate fallback proposal, show diff, apply proposal, create `ai` snapshot, render SVG, and no horizontal overflow
  - Phase 5 settings smoke: AI provider/model/API-key setup lives in Settings, API key appears only for cloud providers, AI panel no longer contains setup fields, fallback apply still creates an `ai` snapshot, and no horizontal overflow
  - Phase 5 completion smoke: Settings key fields, AI rail separation, browser fallback stream cancellation, fallback diff/apply, per-document AI history, `ai` snapshot creation, SVG render, and no horizontal overflow
  - Ollama model dropdown smoke: local `/api/tags` discovery surfaced `nomic-embed-text:latest`, `qwen3:4b`, `qwen2.5-coder:14b`, `qwen3:30b`, and `qwen3:32b`; selection persisted; no horizontal overflow
  - AI response copy/proposal smoke: Restyle response produced a diff, Copy copied the response text, and no horizontal overflow
  - Real Ollama UI smoke through Chrome CDP using UI-selected `qwen2.5-coder:14b`: Generate, Edit, Explain, Convert, Restyle, and Fix all completed with non-fallback responses; the five code-producing capabilities showed diffs, applied cleanly, rendered SVG, and created apply snapshots; final AI history count was 6 and final snapshot count was 11
- user GUI pass for fullscreen exit and the Tauri top/menu surface

## Pending / Known Warnings

- Vite reports large chunks because Mermaid and Monaco are bundled; optimize with dynamic imports in a later performance pass.
- Native Phase 3 snapshot/history workflow still needs a human check in the Tauri GUI.
- Phase 3 still needs deeper stress/performance verification against the 1000-snapshot restore targets.
- Phase 4 scanners are intentionally regex-assisted scaffolding; they need broader test coverage before visual mutation is expanded.
- Flowchart visual edits are wired, but inline editing, connection handles, richer edge styling, and non-flowchart mutation UX still need polish.
- Phase 6 has not started: export, copy-as, command palette, shortcut customization, crash recovery polish, file watcher/reload prompt, recents, packaging, performance tests, and release docs are pending.
- Native cloud AI calls need verification only when the user chooses to test OpenAI/Anthropic credentials.
- Native Tauri-window Ollama still needs a human GUI pass, but real local Ollama was programmatically verified through the browser-dev UI path against the same local `/api/generate` provider.
- Browser-dev AI history and API-key fallback use localStorage because browser mode has no native keychain/SQLite access.
- Browser automation has been run through temporary/inline Chrome CDP harnesses; no browser harness is committed into the project.

## Useful Commands

Run the native app:

```bash
cd ./
. "$HOME/.cargo/env"
npm run dev
```

Verification:

```bash
npm run check
npm run build:frontend
cd src-tauri
. "$HOME/.cargo/env"
cargo check
cargo test
```

## Resume Notes

- Read `specs/MERMAID_LOCAL_UPDATED_SPEC.md` before implementing new work.
- Read `planning/product-pivot-roadmap.md` for the migration rationale.
- Do not use the old `swimlane` Mermaid diagram type. The prior prototype already discovered that Mermaid rejected it; use supported Mermaid syntax.
- The old `Qwen2.5 Coder 14B` autonomous subagent workflow was unreliable in this project. Direct implementation remains the preferred path unless the user explicitly asks for delegated agents.
