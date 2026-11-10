# Product Pivot Roadmap

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Why Pivot

The original project proved that a local Mermaid visual editor is viable, but its scope was too narrow for the most useful end-user app. A swimlane-only board solves one diagram shape. The updated product solves the daily Mermaid workflow:

- open Mermaid from disk
- edit code with a real editor
- see a rich visual canvas
- use visual operations when they are faster than typing
- recover every edit
- export for docs
- optionally use local AI to generate, fix, explain, convert, or restyle diagrams

## What Carries Forward

- browser-verified render loop discipline
- last-good-preview behavior
- immediate code/preview synchronization
- explicit interaction affordances
- real-browser verification before acceptance
- Mermaid syntax validation against the actual renderer

## What Is Replaced

- lane/task state as the central model
- generated-only Mermaid output
- vanilla-only dependency rule
- `swimlane` syntax examples
- collaboration as a near-term goal
- finite 20-step undo as the history model

## Product Priorities

1. File-first Mermaid editing.
2. High-quality code editor.
3. Stable canvas for large diagrams.
4. Local history that makes experiments safe.
5. Bidirectional edits for high-frequency visual operations.
6. Useful AI that is reviewable and local by default.
7. Export and settings polish.

## Phase Map

- Phase 0: browser prototype, complete.
- Phase 1: desktop skeleton and `.mmd` file loop, implemented and user-verified for native New/Open/Save/Save As.
- Phase 2: canvas, layout, templates, theme, underway with browser-verified pan/zoom/fit/100/fullscreen enter-exit, persisted layout/theme, templates, AI rail, and status feedback.
- Phase 3: snapshots and history.
- Phase 4: AST bridge and visual editing.
- Phase 5: AI.
- Phase 6: v1 hardening.
- Phase 7: post-v1 stretch.

## End-User Definition of Useful

The app is useful when a solo developer, writer, architect, or PM can:

- open an existing Mermaid block from disk
- fix it quickly with diagnostics and AI
- navigate a large visual diagram without losing context
- make common edits visually
- recover any prior version
- export to a doc-ready format
- do all of this without creating an account or sending private diagrams to a cloud service

## Implementation Guardrails

- Do not add cloud dependency to core workflows.
- Do not hide generated state outside `.mmd` except snapshots/settings.
- Keep AI output reviewable before apply.
- Keep Mermaid parser/rendering official and version-pinned.
- Treat unsupported visual editing as read-only, not best-effort mutation.
