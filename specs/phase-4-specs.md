# Phase 4: AST Bridge and Bidirectional Sync

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

Implementation status as of 2026-05-01: source-map slice implemented with AST scaffolding, regex-assisted scanners for the core diagram types, Monaco source highlighting, rendered SVG click selection, snippets palette, settings panel, theme/direction/layout menus, and basic flowchart visual mutation operations. Polish and tests are still pending.

## Goal

Make code and canvas genuinely bidirectional for the core Mermaid diagram types. Canvas selections and edits must map back to source text predictably.

## User Value

A user can click, rename, connect, recolor, reshape, or delete visual elements and trust that the Mermaid code updates cleanly without losing comments or formatting.

## Supported Diagram Types

Full visual edit support in v1:

- `flowchart` / `graph`
- `sequenceDiagram`
- `classDiagram`
- `stateDiagram` / `stateDiagram-v2`
- `erDiagram`

Read-only selection sync for other Mermaid types until scanners are implemented.

## Required Modules

- `src/ast/index.ts`
- `src/ast/parse.ts`
- `src/ast/apply.ts`
- `src/ast/scanners/flowchart.ts`
- `src/ast/scanners/sequence.ts`
- `src/ast/scanners/class.ts`
- `src/ast/scanners/state.ts`
- `src/ast/scanners/er.ts`

## Required API

Expose:

- `parse(code)`
- `applyPatch(code, patch)`
- source map keyed by AST node id
- SVG element mapping keyed by Mermaid rendered ids

Patch operations:

- rename node label
- edit edge label
- add node
- add edge
- delete node
- delete edge
- change node shape
- recolor node
- apply move/layout hint

## Selection Sync

- Click SVG node or edge -> reveal and highlight source span in Monaco.
- Click mapped line in Monaco -> outline corresponding SVG element.
- Keep selection state stable across rerenders where ids still match.

## Visual Editing

- Double-click node label -> inline input overlay -> replace source label.
- Double-click edge label -> inline input overlay -> replace pipe label.
- Right-click canvas -> add node.
- Drag connection handle from node to node -> insert edge.
- Delete selected node or edge with Delete key.
- Shape submenu rewrites Mermaid brackets where supported.
- Color picker adds/replaces `style` or `classDef` lines.

## Positional Dragging

Mermaid does not store manual positions. For v1, dragging writes layout hints into an init directive:

```mermaid
%%{init: {"layoutHints": {"A1": [40, -20]}}}%%
```

After render, apply SVG transforms to mapped elements.

## Loop Prevention

- All visual changes flow through `applyPatch`.
- Monaco updates use `pushEditOperations`.
- A short guard prevents editor change handlers from recursively triggering visual diffs.
- If the user typed within the last 500ms, queue visual edits until idle.

## Tests

- at least 50 AST snapshot tests
- roundtrip parse -> patch -> parse tests
- comment and blank-line preservation
- Unicode label handling
- quoted and unquoted labels
- nested subgraphs

## Exit Criteria

- Five-minute mouse-first authoring demo works for flowcharts.
- Flowchart and sequence selection sync works both directions.
- Rename, add, delete, recolor, reshape, and connect operations update code live.
- Unsupported diagram visual edits are clearly disabled instead of silently corrupting code.

## Current Implementation Notes

- `src/ast/index.ts`, `parse.ts`, `apply.ts`, and core scanner modules now exist.
- Current scanners are intentionally regex-assisted scaffolding; they need broader test coverage before mutation-heavy behavior depends on them.
- Source maps are keyed by AST item id, and line maps support Monaco line-to-SVG selection.
- Rendered SVG elements are matched heuristically by Mermaid ids, classes, labels, and source/target hints.
- Verified browser smoke covers flowchart SVG click to source highlight and Monaco line click to SVG outline.
- `applyPatch` now supports flowchart add node, rename, edit edge label, add edge, delete node, delete edge, change shape, recolor, set direction, and local layout-hint movement.
- The snippets palette supports draggable/clickable flowchart shapes and edge snippets.
- The selection toolbar exposes rename, shape, color, connect, duplicate, and delete actions for mapped items.
- Node drag writes a local `%% mermaid-local-layout: ... %%` comment and reapplies SVG transforms after render.
- Drag/dropped snippets write an initial local layout hint based on the canvas drop point.
- Surface-level fallback hit testing keeps transformed nodes selectable and draggable even when WebView/SVG hit testing lands on the canvas surface.
- Next slice should add inline edit overlays, connection handles, richer edge styling, mutation tests, and graceful disabled states for non-flowchart diagrams.
