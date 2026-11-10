import type * as monaco from "monaco-editor";

let registered = false;

const diagramKeywords = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "quadrantChart",
  "requirementDiagram",
  "gitGraph",
  "mindmap",
  "timeline",
  "zenuml",
  "sankey-beta",
  "xychart-beta",
  "block-beta",
  "packet-beta",
  "kanban",
  "architecture-beta",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment"
];

export function registerMermaidLanguage(monacoInstance: typeof monaco) {
  if (registered) {
    return;
  }

  monacoInstance.languages.register({ id: "mermaid" });
  monacoInstance.languages.setMonarchTokensProvider("mermaid", {
    keywords: diagramKeywords,
    tokenizer: {
      root: [
        [/%%.*/, "comment"],
        [/\b(?:subgraph|end|classDef|class|style|title|participant|actor|loop|alt|else|opt|par|rect|note|direction)\b/, "keyword"],
        [new RegExp(`\\b(?:${diagramKeywords.map((keyword) => keyword.replace(/[-]/g, "\\-")).join("|")})\\b`), "keyword"],
        [/<-->|<==>|<-.->|-->|---|-.->|-.-|==>|===|--o|--x/, "operator"],
        [/[{}()[\]]/, "delimiter"],
        [/"[^"]*"/, "string"],
        [/\|[^|]*\|/, "string"],
        [/[A-Za-z_][\w-]*/, "identifier"]
      ]
    }
  });

  monacoInstance.editor.defineTheme("mermaidLocalDark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7dd3fc" },
      { token: "keyword", foreground: "facc15", fontStyle: "bold" },
      { token: "operator", foreground: "34d399" },
      { token: "string", foreground: "fda4af" },
      { token: "identifier", foreground: "e5e7eb" }
    ],
    colors: {
      "editor.background": "#0b1120",
      "editor.foreground": "#e5e7eb",
      "editorLineNumber.foreground": "#64748b"
    }
  });

  monacoInstance.editor.defineTheme("mermaidLocalLight", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "0369a1" },
      { token: "keyword", foreground: "92400e", fontStyle: "bold" },
      { token: "operator", foreground: "047857" },
      { token: "string", foreground: "be123c" },
      { token: "identifier", foreground: "111827" }
    ],
    colors: {
      "editor.background": "#f8fafc",
      "editor.foreground": "#111827",
      "editorLineNumber.foreground": "#64748b"
    }
  });

  registered = true;
}
