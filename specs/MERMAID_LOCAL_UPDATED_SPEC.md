# Mermaid Local — Product & Engineering Specification

**Version:** 1.0
**Status:** Implementation-ready
**Target:** Offline-first, local desktop application for authoring Mermaid diagrams with AI assistance, bidirectional code/visual editing, infinite canvas, and local snapshot history.

---

## 0. How to Use This Document

This spec is intended to be fed to a coding agent (Codex, Claude Code, Cursor, etc.) as the source of truth. Each section is self-contained enough that an agent can implement it in isolation. Sections labeled **[MUST]** are required for v1; **[SHOULD]** are strong recommendations; **[MAY]** are stretch goals.

Build order is defined in §13 (Implementation Phases). Do not skip phases — later phases depend on data structures from earlier ones.

---

## 1. Vision & Goals

### 1.1 One-Line Summary
A local-first desktop app for creating, editing, and AI-assisting Mermaid diagrams, with a code editor and an infinite visual canvas that stay in sync, and complete local version history.

### 1.2 Why This Exists
The reference product (Mermaid Chart at mermaidchart.com, sometimes called "mermaid.ai") is cloud-hosted, credit-limited, and requires internet. The official open-source Mermaid (mermaid.js.org) is a rendering library, not an editor app. This project fills the gap: a polished local editor that:

1. Runs fully offline — no account, no credits, no cloud round-trip required.
2. Has AI features that work locally (via Ollama) or with the user's own API key.
3. Stores **every edit** as a local snapshot with near-zero overhead, so undo/redo/restore is unbounded and instant.
4. Supports true bidirectional editing: dragging or relabeling on the canvas writes back to the code.
5. Has a real infinite canvas (pan/zoom virtualized, not viewport-locked).

### 1.3 Primary Goals (v1)
- **G1.** Author any Mermaid diagram type with first-class syntax support.
- **G2.** Edit code and see the visual update in <100ms (debounced).
- **G3.** Edit the visual (drag, rename, restyle nodes/edges) and see the code update.
- **G4.** Generate or fix diagrams from natural-language prompts.
- **G5.** Every keystroke creates a recoverable point in local history; restoration is instant.
- **G6.** Work fully offline. Cloud AI is opt-in via user-supplied keys.

### 1.4 Non-Goals (v1)
- Real-time multi-user collaboration.
- Cloud sync between devices (local export/import only).
- Custom diagram types beyond what Mermaid supports.
- Mobile or web deployment.
- Plugin marketplace (architecture supports it, but no marketplace UI in v1).

---

## 2. Target User & Use Cases

### 2.1 User Profile
A solo developer, technical writer, architect, or PM who:
- Frequently makes flowcharts, sequence diagrams, ERDs, system architectures.
- Prefers code-first tools but wants visual feedback.
- Is privacy-conscious or works with sensitive diagrams (internal systems, security models).
- Already uses or is willing to install Ollama for local AI.

### 2.2 Core Use Cases
| ID | Use Case | Frequency |
|----|----------|-----------|
| UC1 | "Generate a flowchart from this paragraph of process docs." | Daily |
| UC2 | "Fix the syntax error in this Mermaid block." | Daily |
| UC3 | "I drew nodes A→B→C; rename B and add a fork to D." | Daily |
| UC4 | "Roll back to what the diagram looked like 20 edits ago." | Weekly |
| UC5 | "Export this diagram as SVG/PNG/PDF for a doc." | Daily |
| UC6 | "Open a `.mmd` file from disk, edit, save back." | Daily |
| UC7 | "Restyle: make all decision nodes amber, all process nodes blue." | Weekly |

---

## 3. Tech Stack

### 3.1 Recommended Stack [MUST]
| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | **Tauri 2.x** | ~3–10MB binaries, native WebView, Rust backend, first-class SQLite, fast cold start |
| Backend lang | **Rust** | Required by Tauri; ideal for SQLite, file watching, snapshot diffing |
| Frontend framework | **React 18 + TypeScript** | Largest editor-component ecosystem (Monaco, dnd-kit) |
| Build | **Vite** | Standard for Tauri+React; fast HMR |
| Code editor | **Monaco Editor** (`@monaco-editor/react`) | Same engine as VSCode; tree-sitter-style tokenization |
| Diagram engine | **mermaid** v11+ (the official npm package) | The actual renderer — do not reimplement |
| Diagram parsing | **mermaid**'s exposed parser API + a thin AST wrapper (§7) | For bidirectional sync |
| Canvas/zoom | **panzoom** (anvaka/panzoom) or **svg-pan-zoom** wrapping the rendered Mermaid SVG | Infinite pan/zoom of SVG output |
| State | **Zustand** | Small, no boilerplate, snapshot-friendly |
| Local DB | **SQLite** via **`tauri-plugin-sql`** or **`rusqlite`** in commands | Snapshots, settings, recents |
| File watching | **`notify`** crate (Rust) | Hot-reload on external file changes |
| Local AI | **Ollama HTTP API** (`http://localhost:11434`) | User installs Ollama separately |
| Cloud AI (opt-in) | **Anthropic Messages API** + **OpenAI Chat Completions** | BYO key; never bundled |
| Styling | **Tailwind CSS** + **Radix UI** primitives | Shadcn-style; matches the look of the reference |
| Icons | **lucide-react** | |

### 3.2 Acceptable Substitutions
- **Electron** instead of Tauri if Rust is a blocker. Note: triples binary size, slows cold start, and you will need `better-sqlite3` instead of `tauri-plugin-sql`.
- **CodeMirror 6** instead of Monaco if bundle size becomes critical (Monaco is ~3MB minified).
- **Svelte** or **SolidJS** instead of React if the implementer prefers; the spec is framework-neutral past §6.

### 3.3 Forbidden
- ❌ Any library that requires network calls at runtime (analytics, telemetry, "phone home").
- ❌ Bundling AI model weights inside the app (license, size, update problems).
- ❌ Cloud-only features with no local fallback.

---

## 4. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Tauri WebView (UI)                     │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Monaco    │  │  Mermaid    │  │  AI Chat Panel       │  │
│  │  Editor    │◄─┤  Renderer   │  │  (prompt → code)     │  │
│  └─────┬──────┘  │  + Canvas   │  └─────────┬────────────┘  │
│        │         └──────┬──────┘            │               │
│        │                │                   │               │
│        │   ┌────────────▼──────────────┐   │               │
│        └──►│  AST Bridge (TS)          │◄──┘               │
│            │  - parse(code) → AST      │                    │
│            │  - apply(patch) → code    │                    │
│            │  - selection ↔ source map │                    │
│            └────────────┬──────────────┘                    │
└─────────────────────────┼───────────────────────────────────┘
                          │ Tauri IPC (invoke / event)
┌─────────────────────────▼───────────────────────────────────┐
│                       Rust Backend                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  SQLite     │  │  File I/O    │  │  AI Proxy        │   │
│  │  Snapshot   │  │  + notify    │  │  - Ollama (local)│   │
│  │  Store      │  │  watcher     │  │  - Anthropic     │   │
│  │             │  │              │  │  - OpenAI        │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.1 Data Flow Examples

**User types in Monaco** → debounced 150ms → Mermaid renders → SVG injected into pan/zoom container → snapshot worker queues a diff → SQLite write.

**User drags a node on canvas** → drag delta → AST bridge `applyPositionalPatch(nodeId, dx, dy)` → updated code → Monaco model updated → re-render confirms.

**User types prompt "make the auth box red"** → Rust AI proxy → Ollama returns updated code → diff shown in chat panel → user accepts → Monaco model replaced → snapshot.

---

## 5. UI Layout

### 5.1 Window Regions
```
┌─────────────────────────────────────────────────────────────┐
│  Top bar: File · Edit · View · Diagram · AI · Help · ⚙      │  32px
├──────────────┬──────────────────────────────┬──────────────┤
│              │                              │              │
│              │                              │              │
│   Code       │       Infinite Canvas        │   AI Chat    │
│   Editor     │       (Mermaid SVG)          │   (drawer,   │
│   (Monaco)   │                              │   collapsible│
│              │                              │   right)     │
│              │                              │              │
│  resizable   │  pan/zoom, fit, 100%, ⛶     │              │
├──────────────┴──────────────────────────────┴──────────────┤
│  Status bar: cursor pos · diagram type · save state · snap# │  24px
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Required UI Behaviors [MUST]
- All three panels independently resizable; persist sizes per-window in SQLite settings table.
- Canvas has overlay toolbar (top-right of canvas region): pan-tool, zoom-in, zoom-out, fit-to-screen, 100%, fullscreen.
- AI chat collapses to a 36px-wide rail with a chat icon; opens to default 380px width.
- Code editor has overlay toolbar (top-right): "Auto-Update" toggle, "Docs" button, "Format" button.
- Status bar shows: line:col · `flowchart TB` (detected diagram type) · "Saved" / "Modified" · "Snap #4127".

### 5.3 Theme
- Light and dark themes [MUST]; system-default detection [MUST].
- Editor theme follows app theme.
- Canvas background: subtle dot grid (#e5e7eb light / #1f2937 dark), 24px spacing.

---

## 6. Feature Specifications

### 6.1 Code Editor [MUST]

**Component:** Monaco Editor instance with custom Mermaid language registered.

**Required behaviors:**
1. Syntax highlighting for all Mermaid diagram types (flowchart, sequence, class, state, ER, mindmap, gantt, git, kanban, packet, pie, quadrant, sankey, timeline, user journey, XY chart, requirement, architecture, block, C4).
2. Bracket matching, auto-indent, line numbers, code folding for `subgraph` blocks.
3. **Format-on-save** [SHOULD]: rewrite arrows, normalize whitespace, align node defs.
4. **Live diagnostic squiggles** [MUST]: parse on every edit (debounced 150ms); show parse errors with red underline + hover message.
5. **Snippets** [MUST]: trigger via `/` or Cmd/Ctrl+Space — flowchart, sequence, class, etc., with tab-stop placeholders.
6. **Find/Replace** [MUST]: standard Monaco Cmd/Ctrl+F.
7. **Multi-cursor & block select** [MUST]: standard Monaco.
8. **Word-wrap toggle** [MUST]: setting + `Alt+Z`.
9. **No "code line limit"** — unlike the reference product, the editor has no artificial line cap.

**Mermaid language definition:** Implement as a Monarch tokenizer (`monaco.languages.register({id:'mermaid'})`). Token classes: `keyword` (flowchart, sequenceDiagram, etc.), `arrow` (`-->`, `-.->`, `==>`), `node-id`, `node-label`, `comment` (`%%`), `class-def` (`classDef`), `style-def` (`style`), `subgraph`, `direction`.

### 6.2 Mermaid Renderer + Infinite Canvas [MUST]

**Renderer:**
- Use `mermaid.render(id, code)` from the official package; returns SVG string.
- Inject SVG into a container `<div id="canvas-host">`.
- On parse error, render last successful SVG with a red border overlay and a toast showing the error.

**Infinite canvas:**
- Wrap the SVG in a pan/zoom controller (panzoom by anvaka or svg-pan-zoom).
- Pan: middle-mouse drag, space+drag, or two-finger trackpad.
- Zoom: Cmd/Ctrl+scroll, pinch, or zoom buttons. Range: 0.05x to 20x.
- "Fit to screen": compute SVG bbox, scale to 90% of viewport, center.
- "100%": reset transform to identity, center.
- "Fullscreen": browser fullscreen API on the canvas region.
- Background dot grid scales with zoom but caps density (no infinite dot count at high zoom).

**Performance requirement:** SVGs up to 2000 nodes must pan/zoom at 60fps. If above threshold, switch SVG to `image-rendering: optimizeSpeed` and disable shadow filters.

### 6.3 Bidirectional Sync (Code ↔ Canvas) [MUST]

This is the headline feature. Implement in three layers.

#### 6.3.1 Source Map
After every successful render, build a map: `{ astNodeId: { line, startCol, endCol } }`. Mermaid's parser exposes node and edge definitions; preserve original source positions during parsing.

Use the parser's diagnostic output combined with a regex-assisted post-pass to identify line numbers for each node/edge. Store in a `SourceMap` object keyed by the auto-generated `<g>` element IDs in the rendered SVG.

#### 6.3.2 Selection Sync (read-only direction first)
- Click an SVG node → look up its astNodeId via `data-id` on the `<g>` → look up source span → highlight that line range in Monaco and reveal it.
- Click a line in Monaco → if the line maps to a node → outline the corresponding SVG element with a 2px accent border.

#### 6.3.3 Visual Edits Write Code
Support these visual operations in v1:

| Operation | UX | Code mutation |
|-----------|----|--------------|
| **Rename node label** | Double-click node → inline `<input>` overlay → Enter | Replace label text in source line, preserving brackets |
| **Edit edge label** | Double-click edge label → inline input | Replace pipe-delimited label segment |
| **Add node** | Right-click empty canvas → "Add node" → type label | Insert new node line at end of relevant subgraph |
| **Connect nodes** | Drag from node edge handle to another node | Insert `A --> B` line |
| **Delete node** | Select + Delete key | Remove node def + all edges referencing it |
| **Delete edge** | Select edge + Delete | Remove the specific edge line |
| **Change node shape** | Right-click → Shape submenu | Rewrite brackets: `[]` → `()` → `{}` → `(())` etc. |
| **Recolor node** | Right-click → Color picker | Add/replace a `style nodeId fill:#cfe8da` line |
| **Drag to reposition** [SHOULD] | Drag node | Mermaid uses ELK/Dagre layout — positions are computed, not stored. **For v1, dragging adjusts a `%% LAYOUT_HINT` comment block** parsed by the app to apply post-layout offsets via SVG transforms. Do NOT pretend Mermaid supports manual layout — it doesn't natively. |

**Implementation note on positional drag:** Maintain a separate JSON sidecar map `{ nodeId: { dx, dy } }` stored in the file as a top-of-file comment block:
```
%%{init: {"layoutHints": {"A1": [40, -20], "A2": [0, 60]}}}%%
```
After Mermaid renders, walk the SVG and apply `transform="translate(dx,dy)"` to each `<g data-id>` that has a hint. This survives re-render.

#### 6.3.4 Conflict & Loop Prevention
- All visual mutations go through a single `applyPatch(patch)` function that updates the Monaco model with `pushEditOperations` (preserving undo stack).
- A 50ms guard flag prevents the resulting onChange handler from re-triggering visual diffing in a loop.
- If the user is actively typing (last keystroke <500ms ago), visual edits are queued and applied on idle.

### 6.4 AI Integration [MUST]

#### 6.4.1 Modes
1. **Local (default)** — Ollama at `http://localhost:11434`. Probe on app start; if missing, show "Install Ollama" CTA with link to https://ollama.com.
2. **Cloud (opt-in)** — User pastes Anthropic or OpenAI API key in Settings. Stored in OS keychain via `tauri-plugin-stronghold` or `keyring` crate. Never logged.

#### 6.4.2 Capabilities
| Feature | Trigger | Input | Output |
|---------|---------|-------|--------|
| **Generate from prompt** | AI panel main input | Prompt text | New diagram code, replacing or appending to current doc |
| **Fix errors** | "Fix" button visible when parser reports error | Current code + error message | Patched code |
| **Edit selection** | Cmd/Ctrl+K with code selected | Selected code + instruction | Replacement for selection |
| **Explain diagram** | "Explain" in AI panel | Current code | Plain-English summary in chat |
| **Convert** | "Convert to..." menu | Current code + target type | New diagram code (e.g., flowchart → sequence) |
| **Restyle** | "Restyle" prompt | Current code + style instruction | Code with added classDef/style lines |

#### 6.4.3 System Prompt (canonical, used for all AI calls)
Store in `/src-tauri/src/ai/prompts.rs`:
```
You are a Mermaid.js expert assistant. You output ONLY valid Mermaid code 
unless the user asks for explanation. Never wrap code in markdown fences. 
Never include commentary inside the code block. When fixing errors, change 
the minimum number of lines. When generating new diagrams, prefer:
- flowchart TB unless directionality is specified
- Concise node IDs (A1, A2, B1...)
- Quoted labels when they contain spaces or special chars
- classDef + class assignments over inline styles when 3+ nodes share styling
```

#### 6.4.4 Streaming
All AI responses stream token-by-token into the chat panel and into a "preview" Monaco diff view. User sees a green "Apply" button once stream completes; can cancel mid-stream.

#### 6.4.5 Chat History
Each chat is per-document. Stored in SQLite `ai_messages` table keyed by `document_id`. "New chat" button clears context. "Delete chat" wipes the row set.

#### 6.4.6 Model Selection
Settings panel lists:
- Ollama models (auto-detected via `GET /api/tags`)
- Anthropic models: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` (per current API)
- OpenAI: pulled from `GET /v1/models` if key present
Default: best available local Ollama coding model (e.g., `qwen2.5-coder`, `codellama`).

### 6.5 Local Snapshot System [MUST]

This is a key differentiator. Spec carefully.

#### 6.5.1 Storage Strategy
Use **content-addressable diff chains** in SQLite:

```sql
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  parent_id INTEGER REFERENCES snapshots(id),
  kind TEXT NOT NULL CHECK (kind IN ('full','diff')),
  payload BLOB NOT NULL,            -- full content OR diff (zstd-compressed)
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,      -- unix ms
  trigger TEXT NOT NULL,            -- 'edit','ai','visual','manual','open'
  label TEXT                         -- optional user label
);
CREATE INDEX idx_snap_doc_time ON snapshots(document_id, created_at DESC);
```

- Every Nth snapshot (default 50) is a `full` payload; intermediate ones are `diff` from the prior `full`.
- Use **diff-match-patch** (Google's lib, MIT) ported via `dmp` crate, or `similar` crate for diffing.
- Compress payloads with `zstd` (level 3).
- On restore, walk back to nearest `full` and replay diffs.

#### 6.5.2 Snapshot Triggers
| Trigger | Frequency |
|---------|-----------|
| Keystroke | Debounced 800ms after last edit |
| AI apply | Immediate, labeled with prompt summary |
| Visual edit | Immediate |
| File open | Immediate, labeled "Opened from disk" |
| File save | Immediate, labeled "Saved" |
| Manual (Cmd/Ctrl+Shift+S) | Immediate, prompts for label |

#### 6.5.3 History UI
- Open via clock icon in top bar.
- Vertical timeline panel showing snapshots newest-first.
- Each entry: thumbnail (rendered SVG, cached at 200px wide), timestamp, trigger badge, label.
- Click → preview in main canvas (read-only, shows "Restore" button).
- "Restore" → creates a new snapshot with current state (so nothing is lost), then replaces editor content.
- "Star" toggles a permanent flag (never auto-pruned).

#### 6.5.4 Pruning Policy
Default settings:
- Keep all snapshots from the last 7 days.
- Keep one per hour for 30 days.
- Keep one per day forever for starred documents; one per week otherwise.
- Hard cap: 500MB per document; oldest non-starred pruned first.

User can override per-document and globally in Settings.

#### 6.5.5 Performance Budget
- Snapshot write: <10ms (debounced, off main thread via Rust async task).
- Restore from any point in last 1000 snapshots: <200ms.
- Thumbnail generation: lazy, on history panel open, cached.

### 6.6 File Management [MUST]

#### 6.6.1 File Format
Native format: `.mmd` (plain text, the Mermaid code itself). Layout hints, if any, live as `%%{init:...}%%` directives at the top — meaning files remain compatible with stock Mermaid parsers.

Project format: `.mermaidproj` (a folder, not a single file):
```
my-project.mermaidproj/
├── project.json         # name, created, last opened, settings overrides
├── diagrams/
│   ├── flow-1.mmd
│   ├── seq-2.mmd
│   └── ...
├── snapshots.db         # SQLite, scoped to this project
└── assets/              # optional images referenced in diagrams
```

#### 6.6.2 Required Operations
- `File > New Diagram` (in current project or unsaved)
- `File > New Project`
- `File > Open File` (.mmd)
- `File > Open Project` (folder picker)
- `File > Save` / `Save As`
- `File > Recent` (last 10)
- `File > Import` from clipboard / from raw text paste
- `File > Export` (see §6.8)
- External file watcher: if the open `.mmd` changes on disk (e.g., user edits in another editor), prompt "Reload?" with diff view.

#### 6.6.3 Auto-Save
On by default; writes to disk 2s after last edit. Snapshot system runs independently so undo history survives even if disk write fails.

### 6.7 Templates [MUST]

Replicate the reference UI: a top strip with categories and one-click templates.

Categories: All, Flowchart, Class, Sequence, State, Mindmap, ER, Requirement, Architecture, Block, C4, Gantt, Git, Kanban, Packet, Pie, Quadrant, Sankey, Timeline, User Journey, XY.

Each template = a `.mmd` file shipped in `/src-tauri/resources/templates/`. Loaded into a `templates` table on first run; user can favorite, edit, or add custom templates. Custom templates stored in `~/.config/mermaid-local/templates/`.

Ship at least 30 templates covering all diagram types with realistic examples (auth flow, DB schema, microservices, sprint timeline, etc.).

### 6.8 Export [MUST]

| Format | Method |
|--------|--------|
| **SVG** | Serialize current rendered SVG, inline computed styles, save |
| **PNG** | Render SVG to canvas at 2x DPI, export blob; let user pick 1x/2x/4x |
| **PDF** | Use `pdf-lib` or Tauri's print-to-PDF; embed as vector |
| **Mermaid (.mmd)** | Save raw code |
| **Markdown** | Wrap in ` ```mermaid ` fence |
| **Clipboard** | Each format above as "Copy as ..." |

Export dialog: format selector, scale, transparent-bg toggle, padding slider.

### 6.9 Settings [MUST]

Sections:
1. **General** — theme, language, autosave delay, default diagram type for new files.
2. **Editor** — font, font size, tab size, word wrap, format-on-save, snippets enabled.
3. **Canvas** — grid on/off, grid color, default zoom step, smooth pan toggle.
4. **AI** — provider (local/anthropic/openai), Ollama URL, API keys (masked), default model, max tokens, temperature, system prompt override.
5. **Snapshots** — pruning policy (7/30/forever sliders), max disk per doc, "Compact now" button.
6. **Keyboard** — full shortcut list, rebindable.
7. **Advanced** — telemetry toggle (default OFF, no telemetry endpoint exists), reset all, export settings JSON.

Settings stored in SQLite `settings` table (key/value/json). Per-user file at `~/.config/mermaid-local/settings.db`.

### 6.10 Keyboard Shortcuts [MUST]

| Action | Mac | Win/Linux |
|--------|-----|-----------|
| New diagram | ⌘N | Ctrl+N |
| Open file | ⌘O | Ctrl+O |
| Save | ⌘S | Ctrl+S |
| Save As | ⇧⌘S | Ctrl+Shift+S |
| Manual snapshot | ⌥⇧⌘S | Ctrl+Alt+Shift+S |
| Undo / Redo | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Y |
| AI prompt (selection) | ⌘K | Ctrl+K |
| Toggle AI panel | ⌘J | Ctrl+J |
| Toggle code editor | ⌘1 | Ctrl+1 |
| Toggle canvas | ⌘2 | Ctrl+2 |
| Toggle history | ⌘H | Ctrl+H |
| Fit to screen | ⌘0 | Ctrl+0 |
| 100% zoom | ⌘1 (canvas focus) | Ctrl+1 |
| Format diagram | ⇧⌥F | Shift+Alt+F |
| Find | ⌘F | Ctrl+F |
| Command palette | ⇧⌘P | Ctrl+Shift+P |
| Fullscreen canvas | F11 | F11 |

---

## 7. AST Bridge — Detailed Spec

This module is the linchpin of bidirectional sync. Lives at `/src/ast/`.

### 7.1 Public API
```typescript
interface AstNode {
  id: string;            // matches SVG <g data-id>
  type: 'node' | 'edge' | 'subgraph' | 'directive' | 'classDef' | 'style';
  label?: string;
  shape?: NodeShape;
  source: { line: number; startCol: number; endCol: number };
  parent?: string;       // subgraph id
  children?: string[];   // for subgraphs
  edges?: { from: string; to: string; label?: string; arrow: ArrowType }[];
}

interface Ast {
  diagramType: string;   // 'flowchart' | 'sequenceDiagram' | ...
  direction?: 'TB'|'LR'|'BT'|'RL';
  nodes: Map<string, AstNode>;
  edges: AstEdge[];
  classDefs: Map<string, StyleProps>;
  raw: string;           // original code
}

function parse(code: string): { ast: Ast; errors: ParseError[] };
function applyPatch(code: string, patch: Patch): string;

type Patch =
  | { op: 'rename'; nodeId: string; newLabel: string }
  | { op: 'reshape'; nodeId: string; shape: NodeShape }
  | { op: 'recolor'; nodeId: string; fill?: string; stroke?: string }
  | { op: 'addNode'; id: string; label: string; shape: NodeShape; parent?: string }
  | { op: 'deleteNode'; nodeId: string }
  | { op: 'addEdge'; from: string; to: string; label?: string; arrow?: ArrowType }
  | { op: 'deleteEdge'; edgeId: string }
  | { op: 'moveHint'; nodeId: string; dx: number; dy: number };
```

### 7.2 Implementation Approach
Mermaid does not export a stable public AST API, but it does expose `mermaid.parse(text)` which validates and `mermaidAPI.getDiagramFromText(text)` which returns an internal diagram object. Use these defensively (wrap in try/catch, version-pin Mermaid).

For source position tracking, post-process the original text with a hand-written line scanner (regex per diagram type) since Mermaid's parser strips position info from many node types. Keep this scanner in `/src/ast/scanners/{flowchart,sequence,class,...}.ts` — one per diagram type.

For v1, **fully implement** the bridge for: `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`. For other types, fall back to read-only sync (selection highlighting works, visual edits are disabled).

### 7.3 Test Coverage
Must include 50+ snapshot tests covering: roundtrip parse → applyPatch → reparse equivalence; preservation of comments and blank lines; handling of Unicode labels; quoted vs unquoted labels; nested subgraphs.

---

## 8. Data Model — Full Schema

```sql
-- documents.db (per project, lives in .mermaidproj/snapshots.db)

CREATE TABLE documents (
  id TEXT PRIMARY KEY,           -- uuid
  filename TEXT NOT NULL,
  diagram_type TEXT,
  content TEXT NOT NULL,         -- current state, redundant with last snapshot but fast
  created_at INTEGER NOT NULL,
  modified_at INTEGER NOT NULL,
  starred INTEGER DEFAULT 0
);

CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES snapshots(id),
  kind TEXT NOT NULL CHECK (kind IN ('full','diff')),
  payload BLOB NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  trigger TEXT NOT NULL,
  label TEXT,
  thumbnail BLOB                 -- nullable; png bytes, generated lazily
);
CREATE INDEX idx_snap_doc_time ON snapshots(document_id, created_at DESC);
CREATE INDEX idx_snap_starred ON snapshots(document_id) WHERE label IS NOT NULL;

CREATE TABLE ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  role TEXT NOT NULL,            -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at INTEGER NOT NULL,
  resulted_in_snapshot INTEGER REFERENCES snapshots(id)
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_builtin INTEGER NOT NULL,
  is_favorite INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- settings.db (global, ~/.config/mermaid-local/)

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON
);

CREATE TABLE recents (
  path TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- 'file'|'project'
  last_opened INTEGER NOT NULL
);

CREATE TABLE api_keys (
  provider TEXT PRIMARY KEY,     -- 'anthropic'|'openai'
  key_ref TEXT NOT NULL          -- pointer into OS keychain; never the raw key
);
```

---

## 9. File / Folder Structure

```
mermaid-local/
├── src/                          # frontend (React + TS)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Editor/               # Monaco wrapper
│   │   ├── Canvas/               # mermaid render + panzoom
│   │   ├── AIPanel/              # chat + streaming preview
│   │   ├── HistoryPanel/         # snapshot timeline
│   │   ├── TemplatesBar/
│   │   ├── StatusBar/
│   │   ├── Toolbar/
│   │   └── ui/                   # radix primitives, buttons, tooltips
│   ├── ast/
│   │   ├── index.ts
│   │   ├── parse.ts
│   │   ├── apply.ts
│   │   └── scanners/
│   │       ├── flowchart.ts
│   │       ├── sequence.ts
│   │       ├── class.ts
│   │       ├── state.ts
│   │       └── er.ts
│   ├── store/                    # Zustand stores
│   │   ├── document.ts
│   │   ├── canvas.ts
│   │   ├── ai.ts
│   │   ├── history.ts
│   │   └── settings.ts
│   ├── ipc/                      # typed wrappers around tauri invoke()
│   │   ├── snapshots.ts
│   │   ├── files.ts
│   │   └── ai.ts
│   ├── lang/
│   │   └── mermaid-monarch.ts    # Monaco tokenizer
│   ├── styles/
│   └── workers/
│       └── render.worker.ts      # off-main-thread mermaid render for big diagrams
│
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   ├── resources/
│   │   └── templates/            # bundled .mmd files
│   └── src/
│       ├── main.rs
│       ├── commands/
│       │   ├── files.rs
│       │   ├── snapshots.rs
│       │   ├── ai.rs
│       │   └── settings.rs
│       ├── db/
│       │   ├── mod.rs
│       │   ├── migrations.rs
│       │   └── schema.sql
│       ├── ai/
│       │   ├── mod.rs
│       │   ├── ollama.rs
│       │   ├── anthropic.rs
│       │   ├── openai.rs
│       │   └── prompts.rs
│       ├── snapshots/
│       │   ├── mod.rs
│       │   ├── diff.rs
│       │   └── prune.rs
│       └── watch.rs              # notify file watcher
│
├── tests/
│   ├── ast/
│   ├── snapshots/
│   └── e2e/                      # Playwright via tauri-driver
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── KEYBINDINGS.md
│   └── AI_PROMPTS.md
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── README.md
└── LICENSE                       # MIT
```

---

## 10. Performance Requirements

| Metric | Target |
|--------|--------|
| Cold start to interactive | <1.5s on M1 / mid-range x86 |
| Keystroke → re-render | <100ms for diagrams under 200 nodes; <300ms up to 2000 nodes |
| Snapshot write | <10ms p95 |
| History panel open (1000 snapshots) | <500ms |
| Restore from snapshot | <200ms |
| AI streaming first token (Ollama) | <2s on local 7B model |
| Memory at idle (500-line diagram) | <250MB RSS |
| Binary size | <30MB installed |

If any target is missed, the build fails CI. Implement performance tests in `/tests/perf/`.

---

## 11. Security & Privacy

1. **No telemetry, no analytics, no auto-update calls in v1.** If auto-update is added later, it must be opt-in and use a transparent manifest URL.
2. **API keys** stored in OS keychain (`tauri-plugin-stronghold` or `keyring` crate). Never written to logs, never sent anywhere except the user-selected provider.
3. **Network allowlist** in `tauri.conf.json`: only `http://localhost:11434` (Ollama), `https://api.anthropic.com`, `https://api.openai.com`. All other network requests blocked at the Tauri layer.
4. **Filesystem scope**: Tauri filesystem permissions limited to user-chosen paths (no broad-disk access).
5. **CSP** strict: `default-src 'self'; script-src 'self'; connect-src 'self' http://localhost:11434 https://api.anthropic.com https://api.openai.com;`.
6. **Prompt injection awareness**: AI responses are never auto-applied. User clicks "Apply" after reviewing diff.
7. **Code execution**: Mermaid's `securityLevel` set to `'strict'` — no inline HTML/JS in labels.

---

## 12. Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Mermaid parse error | Keep last good SVG visible, show inline editor squiggle + toast with line number |
| Ollama not running | Show banner "Local AI offline — start Ollama or switch to cloud in Settings" |
| Cloud API key invalid | Toast + open Settings to AI section |
| AI rate limit hit | Backoff message, suggest switching provider |
| Disk full on snapshot | Graceful failure, prompt user to compact history, keep editing in memory |
| File deleted on disk while open | Detect via watcher, prompt "Save as?" |
| Two windows open same file | Lock file `.mmd.lock`; second window opens read-only with "Take over" button |
| Pasted huge diagram (>10k lines) | Warn user, offer to render with simplified styling |
| Unicode in node IDs | Treat IDs as opaque strings, never assume ASCII |
| App crash mid-edit | On next launch, recover from last snapshot, show "Recovered unsaved changes" toast |

---

## 13. Implementation Phases

### Phase 1 — Skeleton (Week 1)
- Tauri + React + Vite scaffold
- Monaco editor with plain-text Mermaid highlighting
- Mermaid render in static div
- Basic file open/save
- **Exit criteria:** Can open a `.mmd` file, edit it, see live preview, save it.

### Phase 2 — Canvas (Week 2)
- Pan/zoom infinite canvas
- Three-panel resizable layout
- Templates bar + at least 10 built-in templates
- Light/dark theme
- **Exit criteria:** Reference UI is recognizable; canvas behaves like the screenshots.

### Phase 3 — Snapshot System (Week 3)
- SQLite integration via Tauri SQL plugin
- Snapshot triggers, diff/full storage, zstd compression
- History panel with timeline + thumbnails
- Restore flow
- **Exit criteria:** 1000 keystrokes produce 1000 recoverable points; restore is instant.

### Phase 4 — AST Bridge & Bidirectional Sync (Week 4–5)
- Source map for flowchart + sequence
- Click-to-highlight (both directions)
- Inline label rename
- Add/delete node, add/delete edge via right-click
- Recolor, reshape
- Drag-positioning with `%%{init:layoutHints}` directive
- **Exit criteria:** Five-minute screencast: mouse-only diagram authoring, code panel updates live, no text typing required.

### Phase 5 — AI Integration (Week 6)
- Ollama provider, Anthropic, OpenAI providers behind a trait
- AI panel UI with streaming
- Generate / Fix / Edit-selection / Explain / Convert / Restyle commands
- Cmd+K selection edit
- AI message history per document
- **Exit criteria:** All six AI capabilities work end-to-end with both local and cloud providers.

### Phase 6 — Polish (Week 7)
- Export pipeline (SVG/PNG/PDF)
- Settings UI for all panels
- Command palette
- Keyboard shortcut customization
- Crash recovery
- All performance targets met
- **Exit criteria:** Ready for v1.0 release.

### Phase 7 (post-v1) — Stretch
- Project workspaces with multiple diagrams in tabs
- Diagram-to-diagram links (click sends to another diagram)
- Plugin API
- Collaborative cursors over WebRTC (no server)
- Mobile companion (read-only)

---

## 14. Acceptance Criteria for v1.0

The build is shippable when ALL of the following pass:

- [ ] Installs and launches on macOS, Windows, Linux.
- [ ] Cold start <1.5s.
- [ ] All 20 Mermaid diagram types render.
- [ ] Bidirectional sync works for flowchart, sequence, class, state, ER.
- [ ] Pan/zoom is smooth (60fps) for 2000-node diagram.
- [ ] Snapshot system: 10,000 snapshots in DB, restore from any in <200ms.
- [ ] Ollama local generation works with at least one coding model.
- [ ] Anthropic and OpenAI cloud generation works with user-supplied keys.
- [ ] Export to SVG, PNG (1x/2x/4x), PDF, clipboard.
- [ ] Auto-save + crash recovery works.
- [ ] No network requests except to allowlisted endpoints (verified with proxy logs).
- [ ] No telemetry of any kind.
- [ ] Binary <30MB.
- [ ] All keyboard shortcuts function on all OSes.
- [ ] 200+ unit tests pass; 30+ E2E tests pass.
- [ ] README covers install, first-run, AI setup, file format.

---

## 15. Open Questions for the Implementer

These are decisions intentionally left to the build phase, with recommendations:

1. **Should drag-positioning be true positional layout, or hint-based (recommended)?**
   *Recommendation:* hint-based for v1; revisit after Mermaid v12 if it adds positional layout natively.

2. **Should the AI panel support function-calling / tool use?**
   *Recommendation:* No for v1. Plain text-in / code-out is enough. Add tool use in v2 to enable AI-driven multi-step edits.

3. **Should snapshots be per-document or global?**
   *Recommendation:* Per-project, in the project's SQLite. Standalone files use a per-user `~/.config/mermaid-local/scratch.db`.

4. **Image generation for backgrounds / illustrations (matching the reference)?**
   *Recommendation:* Out of scope for v1.

5. **Does the user want a CLI?**
   *Recommendation:* `mermaid-local render input.mmd --out diagram.png` would be useful; ship as a separate Rust binary in the same workspace, post-v1.

---

## 16. Appendix A — Mermaid Quick Reference for Implementer

The implementer should be aware these are all valid Mermaid diagram opener keywords (set as Monarch tokens):

`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `stateDiagram-v2`, `erDiagram`, `journey`, `gantt`, `pie`, `quadrantChart`, `requirementDiagram`, `gitGraph`, `mindmap`, `timeline`, `zenuml`, `sankey-beta`, `xychart-beta`, `block-beta`, `packet-beta`, `kanban`, `architecture-beta`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`.

Common arrow tokens: `-->`, `---`, `-.->`, `-.-`, `==>`, `===`, `--o`, `--x`, `<-->`, `<==>`, `<-.->`.

Subgraph syntax: `subgraph Name [Optional Title]` ... `end`.

Style directive: `style nodeId fill:#cfe8da,stroke:#264235,color:#123456`.
Class directive: `classDef className fill:#cfe8da,...` then `class node1,node2 className`.
Init directive: `%%{init: { "theme": "default", "flowchart": {...} } }%%`.

---

## 17. Appendix B — Ollama Setup Guide (for end-user docs)

The README should include:

```
1. Install Ollama: https://ollama.com
2. Pull a coding model:
   ollama pull qwen2.5-coder
   (or codellama, deepseek-coder, etc.)
3. Ensure Ollama is running: ollama serve
4. In Mermaid Local: Settings > AI > Provider: Ollama, Model: qwen2.5-coder
5. You're ready. No internet required from this point.
```

---

## 18. Appendix C — Example Tauri Commands (Rust signatures)

```rust
#[tauri::command]
async fn save_snapshot(
    document_id: String,
    content: String,
    trigger: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, AppError> { ... }

#[tauri::command]
async fn restore_snapshot(
    snapshot_id: i64,
    state: State<'_, AppState>,
) -> Result<String, AppError> { ... }

#[tauri::command]
async fn list_snapshots(
    document_id: String,
    limit: u32,
    offset: u32,
    state: State<'_, AppState>,
) -> Result<Vec<SnapshotMeta>, AppError> { ... }

#[tauri::command]
async fn ai_complete(
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    on_token: Channel<String>,
) -> Result<String, AppError> { ... }

#[tauri::command]
async fn export_diagram(
    svg_content: String,
    format: ExportFormat,
    options: ExportOptions,
) -> Result<Vec<u8>, AppError> { ... }
```

---

## 19. Licensing Notes

- The official Mermaid library is MIT-licensed — fine to bundle.
- Monaco is MIT.
- Tauri is Apache 2.0 / MIT.
- diff-match-patch is Apache 2.0.
- Recommend releasing this app as MIT.
- Ollama, Anthropic, OpenAI are external services — their TOS apply when used; document this in README.

---

**End of specification.** An implementer with this document, a Tauri+React scaffold, and access to a coding agent should be able to deliver a working v1 in 6–7 weeks of full-time work.
