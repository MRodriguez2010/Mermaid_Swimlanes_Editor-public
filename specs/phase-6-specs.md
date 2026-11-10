# Phase 6: Release Polish and v1 Hardening

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

Implementation status as of 2026-05-02: pending. Phase 1 through the Phase 5 AI baseline are implemented; Phase 6 is the active next phase.

## Goal

Finish the app surface area required for a useful v1 release: export, settings, keyboard customization, crash recovery, performance, packaging, and documentation.

## User Value

A user can adopt Mermaid Local as a daily editor: configure it, export diagrams, recover from crashes, use shortcuts, and trust privacy/performance guarantees.

## Required Features

- export dialog
- export SVG, PNG at 1x/2x/4x, PDF, Mermaid, Markdown
- copy as SVG, PNG, Mermaid, Markdown
- settings sections:
  - General
  - Editor
  - Canvas
  - AI
  - Snapshots
  - Keyboard
  - Advanced
- command palette
- keyboard shortcut customization
- crash recovery from last snapshot
- file watcher reload prompt with diff
- recent files/projects
- app packaging for macOS, Windows, Linux

## Performance Requirements

Meet or explicitly fail CI for:

- cold start under 1.5s
- keystroke to render under 100ms for diagrams under 200 nodes
- keystroke to render under 300ms up to 2000 nodes
- snapshot write under 10ms p95
- restore under 200ms
- history panel under 500ms for 1000 entries
- idle memory under 250MB for a 500-line diagram
- installed binary under 30MB where Tauri target allows

## Security and Privacy

- no telemetry
- strict CSP
- Mermaid `securityLevel: "strict"`
- filesystem access only through user-chosen paths
- network allowlist only for configured AI providers
- API keys in OS keychain only

## Testing

- 200+ unit tests across AST, renderer, snapshots, file commands, AI command shaping, settings
- 30+ end-to-end tests through Tauri driver or equivalent
- performance test suite
- network privacy verification with proxy logs
- export golden tests for SVG/PNG/PDF where practical

## Exit Criteria

- v1 acceptance checklist in `MERMAID_LOCAL_UPDATED_SPEC.md` passes.
- README covers install, first run, Ollama setup, file format, export, privacy, and troubleshooting.
- Release artifacts install and launch on macOS, Windows, and Linux.
