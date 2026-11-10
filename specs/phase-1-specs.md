# Phase 1: Desktop Skeleton

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Goal

Create the smallest useful Mermaid Local desktop app: open or type Mermaid code, see a live rendered preview, and save the `.mmd` file back to disk.

The previous swimlane editor is complete as Phase 0. Do not continue its dependency-light constraint into this phase.

## User Value

A user can install/run the app locally, open an existing Mermaid file, edit it with a real code editor, see immediate visual feedback, and save without using a browser or cloud service.

## Required Stack

- Tauri 2.x shell
- React 18 + TypeScript frontend
- Vite build
- Monaco Editor with initial Mermaid language registration
- Mermaid v11+ official npm package
- Rust Tauri commands for file open/save

## Scope

- Tauri + React + TypeScript scaffold
- main app window with code editor and preview region
- Monaco editor configured for Mermaid text
- minimal Mermaid tokenizer for keywords, arrows, comments, `subgraph`, `classDef`, `style`
- debounced render path: editor change -> parse/render -> preview update
- parse error surface that keeps the last successful SVG visible
- open `.mmd` from disk
- save and save-as `.mmd`
- basic modified/saved state in the UI
- initial sample diagram when no file is open

## Out of Scope

- infinite canvas controls
- templates bar
- SQLite snapshot history
- AST-driven visual editing
- AI integration
- export beyond saving raw `.mmd`

## Migration Notes From Phase 0

Keep these lessons:

- immediate code/preview sync matters
- Mermaid syntax must be validated against the real renderer early
- preview errors should not destroy the last useful visual
- responsive layout must be tested in a real browser/webview

Do not migrate:

- lane/task state as the core data model
- generated-code-only workflow
- vanilla-only dependency restriction
- unsupported `swimlane` Mermaid syntax

## Milestones

1. Scaffold Tauri + React + TypeScript + Vite.
2. Install and wire Mermaid and Monaco.
3. Render a hardcoded Mermaid sample.
4. Replace hardcoded sample with editor-driven code.
5. Add debounced rendering and diagnostics surface.
6. Add file open/save commands.
7. Add smoke tests for render success, parse error behavior, and save roundtrip.

## Exit Criteria

- App launches as a desktop Tauri app.
- User can open a `.mmd` file.
- User can edit code in Monaco.
- Preview updates after edits in under 100ms for diagrams under 200 nodes, using a debounce where needed.
- User can save back to `.mmd`.
- Parse errors are visible and the last successful render remains visible.
- No network calls are made except loading local app assets.
