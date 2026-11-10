# Phase 2: Canvas and App Shell

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Goal

Turn the Phase 1 skeleton into a recognizable Mermaid Local workspace with resizable panels, infinite canvas behavior, templates, theme support, and status feedback.

## Current Implementation Status

Implemented and browser-verified:

- resizable editor/canvas/AI workspace with local persisted dimensions
- light/dark theme with system-preference initial value and local persistence
- template strip with 11 built-in templates, including block/architecture
- canvas pan tool, drag panning, wheel/trackpad panning, zoom controls, fit, 100%, and fullscreen enter/exit
- collapsed/expanded AI rail placeholder
- editor toolbar for auto-update, manual render, basic format, and docs
- status bar cursor position, diagram type, save state, render state, and snapshot placeholder
- desktop top surface grouped as File/Edit/View/Diagram/AI/Help/Settings with only wired commands
- layout reset command for restoring persisted panel widths and collapsed AI state

Still needs native GUI human verification after the latest changes:

- fullscreen exits correctly with the same canvas toolbar button
- latest Phase 2 resize/theme/template/editor-toolbar/top-menu controls behave correctly in Tauri

## User Value

A user can work in a polished desktop layout, pick a useful starter template, pan/zoom large diagrams smoothly, and understand save/render state at a glance.

## Required Features

- three-region layout: code editor, canvas, AI rail placeholder
- independently resizable panels with persisted dimensions
- top bar: File, Edit, View, Diagram, AI, Help, Settings
- status bar: cursor position, detected diagram type, saved/modified state, snapshot placeholder
- canvas host wrapping rendered SVG with pan/zoom
- canvas toolbar: pan tool, zoom in, zoom out, fit, 100%, fullscreen
- light and dark themes with system-default detection
- subtle dot-grid canvas background
- templates bar with at least 10 built-in templates
- template categories matching the updated spec taxonomy

## Canvas Requirements

- Pan with middle mouse, space+drag, and trackpad gestures where available.
- Zoom with Cmd/Ctrl+scroll, pinch, and toolbar buttons.
- Zoom range: 0.05x to 20x.
- Fit-to-screen centers the rendered SVG at 90% of available viewport.
- 100% resets scale and recenters.
- Fullscreen targets the canvas region.

## Template Requirements

- Store built-in templates in the future Tauri resources path.
- Phase 2 can load templates from frontend fixtures until resource loading exists.
- Include useful examples for flowchart, sequence, class, state, ER, timeline, gantt, mindmap, pie, and architecture/block-style diagrams.

## Out of Scope

- full 30-template catalog
- snapshot persistence
- real AI chat behavior
- AST visual edits
- export dialog

## Exit Criteria

- Reference app shape is recognizable from the updated spec.
- User can switch templates and immediately render them.
- Canvas pan/zoom is smooth for normal diagrams.
- Panel sizes persist across app reloads, even if persistence is local storage until Phase 3 SQLite settings land.
- Light/dark theme switches affect editor, canvas, and shell.
- No horizontal overflow or overlapping controls at common desktop widths.
