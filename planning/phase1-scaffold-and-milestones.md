# Phase 1 Scaffold + Milestones

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Recommended Approach

Build the real v1 foundation as **Tauri 2.x + React 18 + TypeScript + Vite**.

The existing vanilla prototype should remain runnable as Phase 0 reference material. It proved useful interaction and render behavior, but it is not the architecture for the end-user app.

## Target File Layout

```text
Mermaid_Swimlanes_Editor/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Editor/
│   │   ├── Canvas/
│   │   ├── StatusBar/
│   │   └── Toolbar/
│   ├── ipc/
│   │   └── files.ts
│   ├── lang/
│   │   └── mermaid-monarch.ts
│   ├── store/
│   │   └── document.ts
│   └── styles/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       └── commands/
│           └── files.rs
├── package.json
├── tsconfig.json
└── vite.config.ts
```

The old browser prototype files can stay temporarily at repo root until the desktop scaffold has equivalent live preview and file behavior.

## Milestone Sequence

### Milestone 1 - Tauri App Boots

- Create Tauri + React + TypeScript scaffold.
- Confirm dev server opens inside Tauri WebView.
- Add a minimal app shell with editor and preview regions.

### Milestone 2 - Mermaid Rendering

- Install official `mermaid` package.
- Render a hardcoded `flowchart TB` sample.
- Keep last successful SVG visible after a render error.
- Show a visible diagnostic surface for failures.

### Milestone 3 - Monaco Editor

- Install Monaco wrapper.
- Register `mermaid` language.
- Add minimal Monarch tokenizer.
- Replace hardcoded sample with Monaco model content.
- Debounce render on edit.

### Milestone 4 - File Commands

- Add Rust commands for open, save, and save-as.
- Add typed frontend IPC wrapper.
- Track file path and modified/saved state.
- Ensure `.mmd` content is plain text Mermaid.

### Milestone 5 - Smoke Tests

- Syntax/type checks for frontend and Rust.
- Render success test for valid Mermaid.
- Render error test that preserves last good SVG.
- File roundtrip test for `.mmd`.

## Phase 1 Exit Test

1. Launch app in Tauri.
2. Open an existing `.mmd`.
3. Edit code in Monaco.
4. Confirm preview updates.
5. Save file.
6. Reopen file and confirm changes persisted.
7. Introduce a syntax error and confirm the last good preview remains visible.

## Risks

- Tauri setup may require system packages in this environment.
- Monaco and Mermaid bundling may need Vite config tuning.
- Mermaid parser APIs are version-sensitive; pin Mermaid early.
- File dialog behavior differs by OS; isolate in Rust commands and typed IPC.
