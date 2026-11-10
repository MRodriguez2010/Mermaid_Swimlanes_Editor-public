import { create } from "zustand";

export const defaultMermaidContent = `flowchart TB
  A[Start] --> B{Decision}
  B -->|Yes| C[Ship]
  B -->|No| D[Revise]`;

interface LoadFileInput {
  documentId?: string;
  path: string | null;
  fileName?: string;
  content: string;
}

interface DocumentStore {
  documentId: string;
  filePath: string | null;
  fileName: string;
  content: string;
  lastSavedContent: string;
  diagramType: string | null;
  lastGoodSvg: string | null;
  renderStatus: "idle" | "rendering" | "error";
  renderError: string | null;
  appError: string | null;
  modified: boolean;
  setContent: (content: string) => void;
  loadFile: (file: LoadFileInput) => void;
  loadTemplate: (name: string, content: string) => void;
  markSaved: (path: string) => void;
  resetDocument: () => void;
  setAppError: (message: string | null) => void;
  markRenderStart: () => void;
  markRenderSuccess: (svg: string) => void;
  markRenderError: (message: string) => void;
}

function createDocumentId() {
  return crypto.randomUUID();
}

function fileNameFromPath(path: string | null, fallback = "Untitled.mmd") {
  if (!path) {
    return fallback;
  }

  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? fallback;
}

function detectDiagramType(content: string) {
  const firstCodeLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));

  return firstCodeLine?.split(/\s+/)[0] ?? null;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documentId: createDocumentId(),
  filePath: null,
  fileName: "Untitled.mmd",
  content: defaultMermaidContent,
  lastSavedContent: defaultMermaidContent,
  diagramType: detectDiagramType(defaultMermaidContent),
  lastGoodSvg: null,
  renderStatus: "idle",
  renderError: null,
  appError: null,
  modified: false,
  setContent: (content) =>
    set((state) => ({
      content,
      diagramType: detectDiagramType(content),
      modified: content !== state.lastSavedContent
    })),
  loadFile: ({ documentId, path, fileName, content }) =>
    set({
      documentId: documentId ?? createDocumentId(),
      filePath: path,
      fileName: fileNameFromPath(path, fileName),
      content,
      lastSavedContent: content,
      diagramType: detectDiagramType(content),
      modified: false,
      renderError: null,
      appError: null
    }),
  loadTemplate: (name, content) =>
    set({
      documentId: createDocumentId(),
      filePath: null,
      fileName: `${name.replace(/\s+/g, "-").toLowerCase()}.mmd`,
      content,
      lastSavedContent: "",
      diagramType: detectDiagramType(content),
      modified: true,
      renderError: null,
      appError: null
    }),
  markSaved: (path) => {
    const content = get().content;
    set({
      filePath: path,
      fileName: fileNameFromPath(path),
      lastSavedContent: content,
      modified: false
    });
  },
  resetDocument: () =>
    set({
      documentId: createDocumentId(),
      filePath: null,
      fileName: "Untitled.mmd",
      content: defaultMermaidContent,
      lastSavedContent: defaultMermaidContent,
      diagramType: detectDiagramType(defaultMermaidContent),
      modified: false,
      renderError: null,
      appError: null
    }),
  setAppError: (message) =>
    set({
      appError: message
    }),
  markRenderStart: () =>
    set({
      renderStatus: "rendering",
      renderError: null
    }),
  markRenderSuccess: (svg) =>
    set({
      lastGoodSvg: svg,
      renderStatus: "idle",
      renderError: null
    }),
  markRenderError: (message) =>
    set({
      renderStatus: "error",
      renderError: message
    })
}));
