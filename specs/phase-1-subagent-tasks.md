# Phase Task Notes

Source specs:

- `specs/MERMAID_LOCAL_UPDATED_SPEC.md`
- `specs/phase-1-specs.md`

## Historical Context

This file originally split the swimlane prototype into autonomous subagent tasks. That is no longer the current product direction.

## Current Use

Treat this file as a lightweight task checklist for the next implementation session, not as a requirement to use subagents.

Direct implementation in the main session has been more reliable for this project. Only delegate work if the user explicitly asks for agents.

## Phase 0 Prototype Status

Complete and browser-verified:

- static browser app
- Mermaid `timeline` generation
- lane/task interaction prototype
- code/preview synchronization
- drag/drop hardening

## Phase 1 Task Slices

### Slice 1 - Scaffold

- create Tauri 2.x + React 18 + TypeScript + Vite app
- preserve old prototype files until replacement behavior works
- add basic app shell and styling foundation

### Slice 2 - Editor and Render

- install Monaco and Mermaid
- register Mermaid language
- render editor content into preview
- preserve last successful SVG on parse errors

### Slice 3 - File Loop

- add Tauri commands for open/save/save-as
- wire typed frontend IPC helpers
- track current file path
- track saved/modified state

### Slice 4 - Verification

- run frontend type/syntax checks
- run Rust checks
- run app in real Tauri/WebView if environment permits
- verify open -> edit -> render -> save -> reopen

## Phase 1 Acceptance

- desktop app launches
- user can open `.mmd`
- user can edit Mermaid in Monaco
- preview updates live
- user can save `.mmd`
- parse errors do not blank the last good preview
