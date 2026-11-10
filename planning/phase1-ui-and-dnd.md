# UI, Canvas, and Visual Interaction Plan

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Direction Change

The old UI plan centered on a custom swimlane board. The updated app centers on a professional desktop editor:

- Monaco code editor on the left
- infinite Mermaid canvas in the center
- collapsible AI panel on the right
- top menu and bottom status bar

The board-style drag/drop behavior from Phase 0 is useful only as evidence that real browser/webview interaction tests are necessary.

## Phase 1 Layout

- two working regions: editor and preview
- placeholder top bar
- minimal status line for file name and modified state
- visible parse/render errors

## Phase 2 Layout

- resizable editor, canvas, and AI rail
- canvas overlay toolbar
- code editor overlay toolbar
- templates strip
- persistent theme
- persistent panel sizes
- full status bar

## Canvas Interaction Model

- Pan with middle mouse, space+drag, or trackpad.
- Zoom with Cmd/Ctrl+scroll, pinch, and toolbar buttons.
- Fit and 100% controls should be visible in the canvas toolbar.
- Keep SVG panning/zooming independent from Mermaid rerendering.
- Avoid rerendering while the user is only panning or zooming.

## Visual Editing Model

Visual editing starts in Phase 4, after source maps exist.

All visual edits must become code patches:

1. user interacts with SVG
2. app resolves SVG element to AST/source id
3. app builds a patch
4. `applyPatch` updates the Monaco model
5. normal render/snapshot flow runs

Do not maintain a hidden visual-only model that diverges from Mermaid text.

## Useful Phase 0 Lessons

- explicit drag handles reduce accidental edits
- drop/selection affordances need real browser verification
- preview stability matters more than updating on every pixel of movement
- keeping last good render visible is better than blanking on parse errors

## Accessibility and Keyboard

- all toolbar buttons must be keyboard reachable
- focus states must be visible
- Monaco keeps standard editor shortcuts
- app-level shortcuts should avoid conflicts with Monaco focus
- command palette becomes the long-term keyboard fallback for most actions

## Error Handling

- render errors keep last good SVG
- visual edit unsupported for current diagram type -> disabled control plus tooltip/status message
- failed code patch -> no mutation, show diagnostic
- pan/zoom failure -> reset transform control remains available

## Testing

- Playwright/Tauri-driver screenshots for layout at common desktop sizes
- real browser/webview interaction tests for pan/zoom controls
- canvas should not overlap the AI rail or editor after resize
- text and controls should not overflow at minimum supported window size
