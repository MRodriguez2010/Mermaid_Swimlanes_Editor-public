import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import {
  applyPatch,
  parse as parseMermaidAst,
  readLayoutHints,
  type AstItem,
  type FlowchartDirection,
  type FlowchartShape
} from "./ast";
import { AiPanel } from "./components/AI/AiPanel";
import { MermaidCanvas } from "./components/Canvas/MermaidCanvas";
import { CodeEditor } from "./components/Editor/CodeEditor";
import { HistoryPanel } from "./components/HistoryPanel/HistoryPanel";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { TemplatesBar } from "./components/TemplatesBar/TemplatesBar";
import { TopBar } from "./components/Toolbar/TopBar";
import { SelectionToolbar } from "./components/VisualEditing/SelectionToolbar";
import { SnippetsPanel } from "./components/VisualEditing/SnippetsPanel";
import type { DiagramTheme } from "./data/diagram-themes";
import type { MermaidTemplate } from "./data/templates";
import type { VisualSnippet } from "./data/visual-snippets";
import { usePersistentState } from "./hooks/usePersistentState";
import {
  deleteAiApiKey,
  getAiApiKey,
  listAiHistory,
  listOllamaModels,
  runAiRequest,
  saveAiApiKey,
  saveAiHistory,
  type AiCapability,
  type AiHistoryEntry,
  type AiProvider,
  type OllamaModel
} from "./ipc/ai";
import { openMermaidFile, saveMermaidFile, saveMermaidFileAs } from "./ipc/files";
import {
  getLatestDocument,
  getSnapshotContent,
  listSnapshots,
  restoreSnapshot,
  saveSnapshot,
  type SaveSnapshotInput,
  type SnapshotMeta,
  type SnapshotTrigger
} from "./ipc/snapshots";
import { MERMAID_DOCS_URL, openExternalUrl } from "./ipc/system";
import { defaultMermaidContent, useDocumentStore } from "./store/document";

function getInitialTheme(): "dark" | "light" {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function formatMermaidCode(content: string) {
  const normalized = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized ? `${normalized}\n` : "";
}

function detectDiagramType(content: string) {
  const firstCodeLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));

  return firstCodeLine?.split(/\s+/)[0] ?? null;
}

function makeVisualNodeId(label: string) {
  const base = label
    .trim()
    .replace(/[^A-Za-z0-9_ -]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[^A-Za-z]+/, "")
    .slice(0, 26);

  return `${base || "Node"}_${Date.now().toString(36)}`;
}

function astNodeIdFor(diagramType: string | null, sourceId: string) {
  return `${diagramType === "graph" ? "graph" : "flowchart"}:node:${sourceId}`;
}

const defaultLayout = {
  editorWidth: 420,
  aiWidth: 320,
  aiCollapsed: true
};

const defaultAiModels: Record<AiProvider, string> = {
  ollama: "qwen2.5-coder:14b",
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-sonnet-latest"
};

function chooseOllamaModel(models: OllamaModel[], currentModel: string) {
  const installedNames = models.map((model) => model.name);
  if (installedNames.includes(currentModel)) {
    return currentModel;
  }

  return (
    installedNames.find((name) => name === "qwen2.5-coder:14b") ??
    installedNames.find((name) => /coder/i.test(name)) ??
    installedNames.find((name) => !/embed/i.test(name)) ??
    installedNames[0] ??
    currentModel
  );
}

export function App() {
  const resizeStateRef = useRef<{ kind: "editor" | "ai"; startX: number; editorWidth: number; aiWidth: number } | null>(null);
  const editorNoticeTimerRef = useRef<number | null>(null);
  const lastSnapshotContentRef = useRef<string | null>(null);
  const aiRequestTokenRef = useRef(0);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiKeySaveTimerRef = useRef<number | null>(null);
  const content = useDocumentStore((state) => state.content);
  const setContent = useDocumentStore((state) => state.setContent);
  const loadFile = useDocumentStore((state) => state.loadFile);
  const loadTemplate = useDocumentStore((state) => state.loadTemplate);
  const markSaved = useDocumentStore((state) => state.markSaved);
  const resetDocument = useDocumentStore((state) => state.resetDocument);
  const appError = useDocumentStore((state) => state.appError);
  const setAppError = useDocumentStore((state) => state.setAppError);
  const filePath = useDocumentStore((state) => state.filePath);
  const fileName = useDocumentStore((state) => state.fileName);
  const documentId = useDocumentStore((state) => state.documentId);
  const diagramType = useDocumentStore((state) => state.diagramType);
  const renderError = useDocumentStore((state) => state.renderError);
  const [theme, setTheme] = usePersistentState<"dark" | "light">("mermaid-local.theme", getInitialTheme());
  const [diagramTheme, setDiagramTheme] = usePersistentState<DiagramTheme>("mermaid-local.diagramTheme", "auto");
  const [autoUpdate, setAutoUpdate] = usePersistentState("mermaid-local.autoUpdate", true);
  const [snippetsEnabled, setSnippetsEnabled] = usePersistentState("mermaid-local.snippetsEnabled", true);
  const [aiProvider, setAiProvider] = usePersistentState<AiProvider>("mermaid-local.aiProvider", "ollama");
  const [aiModel, setAiModel] = usePersistentState("mermaid-local.aiModel", defaultAiModels.ollama);
  const [aiCapability, setAiCapability] = usePersistentState<AiCapability>("mermaid-local.aiCapability", "generate");
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry[]>([]);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiProposedCode, setAiProposedCode] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [editorSelectionText, setEditorSelectionText] = useState("");
  const [previewContent, setPreviewContent] = useState(content);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [snapshotsReady, setSnapshotsReady] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState("Snapshots starting");
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySnapshots, setHistorySnapshots] = useState<SnapshotMeta[]>([]);
  const [historyPreview, setHistoryPreview] = useState<{ snapshot: SnapshotMeta; content: string } | null>(null);
  const [selectedAstId, setSelectedAstId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layout, setLayout] = usePersistentState("mermaid-local.layout", defaultLayout);
  const canvasContent = historyPreview?.content ?? previewContent;
  const documentAst = useMemo(() => parseMermaidAst(content), [content]);
  const canvasAst = useMemo(() => parseMermaidAst(canvasContent), [canvasContent]);
  const layoutHints = useMemo(() => readLayoutHints(content), [content]);
  const selectedAstItem = useMemo(
    () => documentAst.items.find((item) => item.id === selectedAstId) ?? null,
    [documentAst.items, selectedAstId]
  );
  const selectedSourceSpan = selectedAstId && !historyPreview ? documentAst.sourceMap[selectedAstId] ?? null : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (autoUpdate) {
      setPreviewContent(content);
    }
  }, [autoUpdate, content]);

  useEffect(
    () => () => {
      if (editorNoticeTimerRef.current) {
        window.clearTimeout(editorNoticeTimerRef.current);
      }
      if (aiKeySaveTimerRef.current) {
        window.clearTimeout(aiKeySaveTimerRef.current);
      }
      aiAbortControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (historyPreview || (selectedAstId && !documentAst.sourceMap[selectedAstId])) {
      setSelectedAstId(null);
      setConnectFromId(null);
    }
  }, [documentAst, historyPreview, selectedAstId]);

  const showEditorNotice = useCallback((message: string) => {
    setEditorNotice(message);
    if (editorNoticeTimerRef.current) {
      window.clearTimeout(editorNoticeTimerRef.current);
    }
    editorNoticeTimerRef.current = window.setTimeout(() => setEditorNotice(null), 1800);
  }, []);

  const refreshOllamaModels = useCallback(async () => {
    setOllamaModelsLoading(true);
    setOllamaModelsError(null);
    try {
      const models = await listOllamaModels();
      setOllamaModels(models);
      if (models.length) {
        const nextModel = chooseOllamaModel(models, aiModel);
        if (nextModel !== aiModel) {
          setAiModel(nextModel);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOllamaModels([]);
      setOllamaModelsError(message);
    } finally {
      setOllamaModelsLoading(false);
    }
  }, [aiModel, setAiModel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLayout((currentLayout) => ({ ...currentLayout, aiCollapsed: false }));
        setAiCapability(editorSelectionText ? "edit" : "generate");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorSelectionText, setAiCapability, setLayout]);

  useEffect(() => {
    let cancelled = false;

    async function loadDocumentAiHistory() {
      try {
        const history = await listAiHistory(documentId, 50);
        if (!cancelled) {
          setAiHistory(history);
        }
      } catch (error) {
        if (!cancelled) {
          setAiHistory([]);
          setAppError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadDocumentAiHistory();
    return () => {
      cancelled = true;
    };
  }, [documentId, setAppError]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderApiKey() {
      if (aiProvider === "ollama") {
        setAiApiKey("");
        return;
      }

      try {
        const apiKey = await getAiApiKey(aiProvider);
        if (!cancelled) {
          setAiApiKey(apiKey ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setAiApiKey("");
          setAppError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadProviderApiKey();
    return () => {
      cancelled = true;
    };
  }, [aiProvider, setAppError]);

  useEffect(() => {
    if (aiProvider === "ollama") {
      void refreshOllamaModels();
    }
  }, [aiProvider, refreshOllamaModels]);

  const handleAiProviderChange = useCallback(
    (provider: AiProvider) => {
      setAiProvider(provider);
      setAiModel(defaultAiModels[provider]);
      setAiApiKey("");
    },
    [setAiModel, setAiProvider]
  );

  const handleAiApiKeyChange = useCallback(
    (apiKey: string) => {
      setAiApiKey(apiKey);
      if (aiProvider === "ollama") {
        return;
      }

      if (aiKeySaveTimerRef.current) {
        window.clearTimeout(aiKeySaveTimerRef.current);
      }

      aiKeySaveTimerRef.current = window.setTimeout(() => {
        const savePromise = apiKey.trim()
          ? saveAiApiKey(aiProvider, apiKey)
          : deleteAiApiKey(aiProvider);

        void savePromise.catch((error) => {
          setAppError(error instanceof Error ? error.message : String(error));
        });
      }, 300);
    },
    [aiProvider, setAppError]
  );

  const handleRunAi = useCallback(async () => {
    const requestToken = aiRequestTokenRef.current + 1;
    const requestId = crypto.randomUUID();
    const abortController = new AbortController();
    aiRequestTokenRef.current = requestToken;
    aiAbortControllerRef.current = abortController;
    setAiLoading(true);
    setAiResponse("");
    setAiProposedCode(null);

    try {
      if (aiProvider !== "ollama" && aiApiKey.trim()) {
        await saveAiApiKey(aiProvider, aiApiKey);
      }

      const result = await runAiRequest(
        {
          requestId,
          documentId,
          provider: aiProvider,
          model: aiModel,
          capability: aiCapability,
          prompt: aiPrompt,
          code: content,
          selectedText: editorSelectionText || null,
          renderError,
          apiKey: null
        },
        {
          signal: abortController.signal,
          onEvent: (event) => {
            if (aiRequestTokenRef.current !== requestToken) {
              return;
            }

            if (event.kind === "start") {
              setAiResponse("");
            } else if (event.kind === "chunk" && event.content) {
              setAiResponse((currentResponse) => `${currentResponse}${event.content}`);
            } else if (event.kind === "cancelled") {
              setAiResponse("Cancelled.");
              setAiProposedCode(null);
            } else if (event.kind === "error" && event.error) {
              setAiResponse(event.error);
              setAiProposedCode(null);
            } else if (event.kind === "done" && event.response) {
              setAiResponse(event.response.response);
              setAiProposedCode(event.response.proposedCode);
            }
          }
        }
      );
      if (aiRequestTokenRef.current !== requestToken) {
        return;
      }

      setAiResponse(result.response);
      setAiProposedCode(result.proposedCode);
      try {
        const historyRecord = await saveAiHistory({
          documentId,
          capability: aiCapability,
          provider: result.provider,
          model: result.model,
          prompt: aiPrompt,
          response: result.response,
          proposedCode: result.proposedCode
        });
        if (aiRequestTokenRef.current === requestToken) {
          setAiHistory((currentHistory) => [historyRecord, ...currentHistory].slice(0, 50));
        }
      } catch (historyError) {
        setAppError(historyError instanceof Error ? historyError.message : String(historyError));
      }
    } catch (error) {
      if (aiRequestTokenRef.current === requestToken) {
        const message = error instanceof Error ? error.message : String(error);
        setAiResponse(message.includes("cancelled") || message.includes("AbortError") ? "Cancelled." : message);
      }
    } finally {
      if (aiRequestTokenRef.current === requestToken) {
        setAiLoading(false);
        if (aiAbortControllerRef.current === abortController) {
          aiAbortControllerRef.current = null;
        }
      }
    }
  }, [
    aiApiKey,
    aiCapability,
    aiModel,
    aiPrompt,
    aiProvider,
    content,
    documentId,
    editorSelectionText,
    renderError,
    setAppError
  ]);

  const handleCancelAi = useCallback(() => {
    if (aiLoading) {
      aiRequestTokenRef.current += 1;
      aiAbortControllerRef.current?.abort();
      aiAbortControllerRef.current = null;
      setAiLoading(false);
      setAiResponse("Cancelled.");
      setAiProposedCode(null);
      return;
    }

    setAiResponse("");
    setAiProposedCode(null);
  }, [aiLoading]);

  const loadHistory = useCallback(
    async (targetDocumentId = documentId) => {
      if (!targetDocumentId) {
        return;
      }

      setHistoryLoading(true);
      try {
        const snapshots = await listSnapshots(targetDocumentId, 1000, 0);
        setHistorySnapshots(snapshots);
        setSnapshotCount(snapshots.length);
        setSnapshotStatus(snapshots.length ? `Snap #${snapshots[0].id}` : "No snapshots");
      } catch (error) {
        setSnapshotStatus("Snapshot load failed");
        setAppError(error instanceof Error ? error.message : String(error));
      } finally {
        setHistoryLoading(false);
      }
    },
    [documentId, setAppError]
  );

  const saveSnapshotRecord = useCallback(
    async (input: SaveSnapshotInput) => {
      if (!snapshotsReady && input.trigger === "edit") {
        return null;
      }

      if (input.trigger === "edit" && input.content === lastSnapshotContentRef.current) {
        return null;
      }

      setSnapshotStatus("Saving snapshot");
      try {
        const snapshot = await saveSnapshot(input);
        lastSnapshotContentRef.current = input.content;
        setSnapshotStatus(`Snap #${snapshot.id}`);
        try {
          const snapshots = await listSnapshots(input.documentId, 1000, 0);
          setSnapshotCount(snapshots.length);
          if (historyOpen || input.documentId === documentId) {
            setHistorySnapshots(snapshots);
          }
        } catch {
          setSnapshotCount((currentCount) => currentCount + 1);
        }
        return snapshot;
      } catch (error) {
        setSnapshotStatus("Snapshot failed");
        setAppError(error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [documentId, historyOpen, setAppError, snapshotsReady]
  );

  const saveCurrentSnapshot = useCallback(
    (trigger: SnapshotTrigger, label: string | null, snapshotContent = content) =>
      saveSnapshotRecord({
        documentId,
        fileName,
        filePath,
        diagramType,
        content: snapshotContent,
        trigger,
        label
      }),
    [content, diagramType, documentId, fileName, filePath, saveSnapshotRecord]
  );

  const handleApplyAiProposal = useCallback(async () => {
    if (!aiProposedCode) {
      return;
    }

    setContent(aiProposedCode);
    if (autoUpdate) {
      setPreviewContent(aiProposedCode);
    }
    setHistoryPreview(null);
    setSelectedAstId(null);
    setAiProposedCode(null);
    setAiResponse("Applied AI proposal.");
    showEditorNotice("Applied AI proposal");
    await saveSnapshotRecord({
      documentId,
      fileName,
      filePath,
      diagramType: detectDiagramType(aiProposedCode),
      content: aiProposedCode,
      trigger: "ai",
      label: `AI: ${aiPrompt.trim().slice(0, 80) || aiCapability}`
    });
  }, [
    aiCapability,
    aiPrompt,
    aiProposedCode,
    autoUpdate,
    documentId,
    fileName,
    filePath,
    saveSnapshotRecord,
    setContent,
    showEditorNotice
  ]);

  useEffect(() => {
    let cancelled = false;

    async function recoverLatestDocument() {
      try {
        const recoveredDocument = await getLatestDocument();
        if (cancelled) {
          return;
        }

        if (recoveredDocument) {
          loadFile({
            documentId: recoveredDocument.id,
            path: recoveredDocument.filePath,
            fileName: recoveredDocument.fileName,
            content: recoveredDocument.content
          });
          setPreviewContent(recoveredDocument.content);
          lastSnapshotContentRef.current = recoveredDocument.content;
          setSnapshotStatus("Recovered latest snapshot");
          const snapshots = await listSnapshots(recoveredDocument.id, 1000, 0);
          setHistorySnapshots(snapshots);
          setSnapshotCount(snapshots.length);
          if (snapshots[0]) {
            setSnapshotStatus(`Snap #${snapshots[0].id}`);
          }
        } else {
          setSnapshotStatus("No snapshots");
        }
      } catch (error) {
        if (!cancelled) {
          setSnapshotStatus("Snapshot recovery failed");
          setAppError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setSnapshotsReady(true);
        }
      }
    }

    void recoverLatestDocument();
    return () => {
      cancelled = true;
    };
  }, [loadFile, setAppError]);

  useEffect(() => {
    if (!snapshotsReady || content === lastSnapshotContentRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentSnapshot("edit", null, content);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [content, saveCurrentSnapshot, snapshotsReady]);

  const handleNew = useCallback(() => {
    resetDocument();
    setPreviewContent(defaultMermaidContent);
    setHistoryPreview(null);
    setSelectedAstId(null);
    lastSnapshotContentRef.current = null;
  }, [resetDocument]);

  const handleOpen = useCallback(async () => {
    try {
      const file = await openMermaidFile();
      if (file) {
        const nextDocumentId = crypto.randomUUID();
        loadFile({ ...file, documentId: nextDocumentId });
        setPreviewContent(file.content);
        setHistoryPreview(null);
        setSelectedAstId(null);
        await saveSnapshotRecord({
          documentId: nextDocumentId,
          fileName: file.path.split(/[\\/]/).filter(Boolean).pop() ?? "Untitled.mmd",
          filePath: file.path,
          diagramType: detectDiagramType(file.content),
          content: file.content,
          trigger: "open",
          label: "Opened from disk"
        });
      }
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error));
    }
  }, [loadFile, setAppError]);

  const handleSave = useCallback(async () => {
    try {
      if (filePath) {
        await saveMermaidFile({ path: filePath, content });
        markSaved(filePath);
        await saveCurrentSnapshot("save", "Saved", content);
        return;
      }

      const savedPath = await saveMermaidFileAs({ defaultPath: fileName, content });
      if (savedPath) {
        markSaved(savedPath);
        await saveSnapshotRecord({
          documentId,
          fileName: savedPath.split(/[\\/]/).filter(Boolean).pop() ?? fileName,
          filePath: savedPath,
          diagramType,
          content,
          trigger: "save",
          label: "Saved"
        });
      }
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error));
    }
  }, [
    content,
    diagramType,
    documentId,
    fileName,
    filePath,
    markSaved,
    saveCurrentSnapshot,
    saveSnapshotRecord,
    setAppError
  ]);

  const handleSaveAs = useCallback(async () => {
    try {
      const savedPath = await saveMermaidFileAs({ defaultPath: fileName, content });
      if (savedPath) {
        markSaved(savedPath);
        await saveSnapshotRecord({
          documentId,
          fileName: savedPath.split(/[\\/]/).filter(Boolean).pop() ?? fileName,
          filePath: savedPath,
          diagramType,
          content,
          trigger: "save",
          label: "Saved as"
        });
      }
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error));
    }
  }, [content, diagramType, documentId, fileName, markSaved, saveSnapshotRecord, setAppError]);

  const handleToggleAutoUpdate = useCallback(() => {
    const nextAutoUpdate = !autoUpdate;
    if (nextAutoUpdate) {
      setPreviewContent(content);
    }
    setAutoUpdate(nextAutoUpdate);
    showEditorNotice(nextAutoUpdate ? "Auto-update on" : "Auto-update off");
  }, [autoUpdate, content, setAutoUpdate, showEditorNotice]);

  const handleFormat = useCallback(() => {
    const formatted = formatMermaidCode(content);
    setContent(formatted);
    if (autoUpdate) {
      setPreviewContent(formatted);
    }
    showEditorNotice(formatted === content ? "Already formatted" : "Formatted");
  }, [autoUpdate, content, setContent, showEditorNotice]);

  const handleRender = useCallback(() => {
    setPreviewContent(content);
    setHistoryPreview(null);
    setSelectedAstId(null);
    showEditorNotice("Rendered");
  }, [content, showEditorNotice]);

  const applyVisualPatch = useCallback(
    (patch: Parameters<typeof applyPatch>[1], notice: string) => {
      try {
        const nextContent = applyPatch(content, patch);
        setContent(nextContent);
        if (autoUpdate) {
          setPreviewContent(nextContent);
        }
        setHistoryPreview(null);
        showEditorNotice(notice);
        return nextContent;
      } catch (error) {
        setAppError(error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [autoUpdate, content, setAppError, setContent, showEditorNotice]
  );

  const handleSelectTemplate = useCallback(
    (template: MermaidTemplate) => {
      loadTemplate(template.name, template.code);
      setPreviewContent(template.code);
      setHistoryPreview(null);
      setSelectedAstId(null);
      lastSnapshotContentRef.current = null;
    },
    [loadTemplate]
  );

  const handleEditorLineFocus = useCallback(
    (line: number) => {
      if (historyPreview) {
        return;
      }

      const mappedIds = documentAst.lineMap[line] ?? [];
      const nextId =
        mappedIds.find((itemId) => {
          const item = documentAst.items.find((candidate) => candidate.id === itemId);
          return item?.kind !== "edge";
        }) ?? mappedIds[0];
      if (nextId) {
        setSelectedAstId(nextId);
      }
    },
    [documentAst, historyPreview]
  );

  const handleCanvasSelect = useCallback(
    (itemId: string) => {
      const targetItem = documentAst.items.find((item) => item.id === itemId);
      if (!targetItem) {
        return;
      }

      if (connectFromId && connectFromId !== itemId) {
        const sourceItem = documentAst.items.find((item) => item.id === connectFromId);
        if (sourceItem?.sourceId && targetItem.sourceId && sourceItem.kind !== "edge" && targetItem.kind !== "edge") {
          applyVisualPatch(
            {
              type: "addEdge",
              sourceId: sourceItem.sourceId,
              targetId: targetItem.sourceId,
              label: ""
            },
            "Connected nodes"
          );
          setConnectFromId(null);
          setSelectedAstId(itemId);
          return;
        }
      }

      setSelectedAstId(itemId);
    },
    [applyVisualPatch, connectFromId, documentAst.items]
  );

  const addSnippet = useCallback(
    (snippet: VisualSnippet, dropPoint?: { x: number; y: number }) => {
      if (snippet.kind === "node") {
        const label = window.prompt("Node label", snippet.label);
        if (label === null) {
          return;
        }

        const nextLabel = label.trim() || snippet.label;
        const nodeId = dropPoint ? makeVisualNodeId(nextLabel) : undefined;
        try {
          let nextContent = applyPatch(content, {
            type: "addNode",
            nodeId,
            label: nextLabel,
            shape: snippet.shape
          });
          if (dropPoint && nodeId) {
            nextContent = applyPatch(nextContent, {
              type: "moveLayoutHint",
              itemId: astNodeIdFor(documentAst.diagramType, nodeId),
              dx: dropPoint.x,
              dy: dropPoint.y
            });
          }
          setContent(nextContent);
          if (autoUpdate) {
            setPreviewContent(nextContent);
          }
          setHistoryPreview(null);
          showEditorNotice(dropPoint ? "Dropped node" : "Added node");
        } catch (error) {
          setAppError(error instanceof Error ? error.message : String(error));
        }
        return;
      }

      const selectedNode = selectedAstItem?.kind !== "edge" ? selectedAstItem : null;
      if (!selectedNode?.sourceId) {
        showEditorNotice("Select a node first");
        return;
      }

      const targetId = makeVisualNodeId(snippet.edgeLabel ? "Labeled node" : "Next node");
      const targetLabel = snippet.edgeLabel ? "New node" : "Next node";
      try {
        let nextContent = applyPatch(content, {
          type: "addNode",
          nodeId: targetId,
          label: targetLabel,
          shape: "rectangle"
        });
        nextContent = applyPatch(nextContent, {
          type: "addEdge",
          sourceId: selectedNode.sourceId,
          targetId,
          label: snippet.edgeLabel
        });
        if (dropPoint) {
          nextContent = applyPatch(nextContent, {
            type: "moveLayoutHint",
            itemId: astNodeIdFor(documentAst.diagramType, targetId),
            dx: dropPoint.x,
            dy: dropPoint.y
          });
        }
        setContent(nextContent);
        if (autoUpdate) {
          setPreviewContent(nextContent);
        }
        setHistoryPreview(null);
        showEditorNotice(dropPoint ? "Dropped edge" : "Added edge");
      } catch (error) {
        setAppError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      autoUpdate,
      content,
      documentAst.diagramType,
      selectedAstItem,
      setAppError,
      setContent,
      showEditorNotice
    ]
  );

  const handleRenameSelection = useCallback(() => {
    if (!selectedAstItem) {
      return;
    }

    const nextLabel = window.prompt(selectedAstItem.kind === "edge" ? "Edge label" : "Node label", selectedAstItem.label);
    if (nextLabel === null) {
      return;
    }

    applyVisualPatch(
      selectedAstItem.kind === "edge"
        ? { type: "editEdgeLabel", itemId: selectedAstItem.id, label: nextLabel }
        : { type: "renameNode", itemId: selectedAstItem.id, label: nextLabel },
      selectedAstItem.kind === "edge" ? "Updated edge" : "Renamed node"
    );
  }, [applyVisualPatch, selectedAstItem]);

  const handleDuplicateSelection = useCallback(() => {
    if (!selectedAstItem || selectedAstItem.kind === "edge") {
      return;
    }

    applyVisualPatch(
      {
        type: "addNode",
        label: `${selectedAstItem.label} copy`,
        shape: "rectangle"
      },
      "Duplicated node"
    );
  }, [applyVisualPatch, selectedAstItem]);

  const handleDeleteSelection = useCallback(() => {
    if (!selectedAstItem) {
      return;
    }

    applyVisualPatch(
      selectedAstItem.kind === "edge"
        ? { type: "deleteEdge", itemId: selectedAstItem.id }
        : { type: "deleteNode", itemId: selectedAstItem.id },
      selectedAstItem.kind === "edge" ? "Deleted edge" : "Deleted node"
    );
    setSelectedAstId(null);
  }, [applyVisualPatch, selectedAstItem]);

  const handleShapeChange = useCallback(
    (shape: FlowchartShape) => {
      if (!selectedAstItem || selectedAstItem.kind === "edge") {
        return;
      }

      applyVisualPatch({ type: "changeNodeShape", itemId: selectedAstItem.id, shape }, "Changed shape");
    },
    [applyVisualPatch, selectedAstItem]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedAstItem || selectedAstItem.kind === "edge") {
        return;
      }

      applyVisualPatch({ type: "recolorNode", itemId: selectedAstItem.id, color }, "Changed color");
    },
    [applyVisualPatch, selectedAstItem]
  );

  const handleMoveNode = useCallback(
    (itemId: string, dx: number, dy: number) => {
      applyVisualPatch({ type: "moveLayoutHint", itemId, dx, dy }, "Moved node");
    },
    [applyVisualPatch]
  );

  const handleDirectionChange = useCallback(
    (direction: FlowchartDirection) => {
      applyVisualPatch({ type: "setDirection", direction }, "Changed direction");
    },
    [applyVisualPatch]
  );

  const handleOpenDocs = useCallback(async () => {
    try {
      await openExternalUrl(MERMAID_DOCS_URL);
      showEditorNotice("Docs opened");
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error));
    }
  }, [setAppError, showEditorNotice]);

  const handleToggleAiPanel = useCallback(() => {
    setLayout((currentLayout) => ({ ...currentLayout, aiCollapsed: !currentLayout.aiCollapsed }));
  }, [setLayout]);

  const handleResetLayout = useCallback(() => {
    setLayout(defaultLayout);
  }, [setLayout]);

  const handleSelectSnapshot = useCallback(
    async (snapshot: SnapshotMeta) => {
      try {
        const snapshotContent = await getSnapshotContent(snapshot.id);
        setHistoryPreview({ snapshot, content: snapshotContent });
        setSelectedAstId(null);
      } catch (error) {
        setAppError(error instanceof Error ? error.message : String(error));
      }
    },
    [setAppError]
  );

  const handleManualSnapshot = useCallback(async () => {
    const label = window.prompt("Snapshot label", "Manual snapshot");
    if (label === null) {
      return;
    }

    await saveCurrentSnapshot("manual", label.trim() || "Manual snapshot", content);
  }, [content, saveCurrentSnapshot]);

  const handleRestoreSnapshot = useCallback(async () => {
    if (!historyPreview) {
      return;
    }

    const snapshotId = historyPreview.snapshot.id;
    await saveCurrentSnapshot("manual", `Before restore #${snapshotId}`, content);
    const restoredContent = await restoreSnapshot(snapshotId);
    setContent(restoredContent);
    setPreviewContent(restoredContent);
    setHistoryPreview(null);
    setSelectedAstId(null);
    showEditorNotice(`Restored #${snapshotId}`);
    await saveSnapshotRecord({
      documentId,
      fileName,
      filePath,
      diagramType: detectDiagramType(restoredContent),
      content: restoredContent,
      trigger: "restore",
      label: `Restored snapshot #${snapshotId}`
    });
  }, [
    content,
    diagramType,
    documentId,
    fileName,
    filePath,
    historyPreview,
    saveCurrentSnapshot,
    saveSnapshotRecord,
    setContent,
    showEditorNotice
  ]);

  const workbenchStyle = useMemo(
    () =>
      ({
        "--editor-width": `${layout.editorWidth}px`,
        "--ai-width": `${layout.aiCollapsed ? 40 : layout.aiWidth}px`
      }) as CSSProperties,
    [layout.aiCollapsed, layout.aiWidth, layout.editorWidth]
  );

  const startResize = useCallback(
    (kind: "editor" | "ai", event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStateRef.current = {
        kind,
        startX: event.clientX,
        editorWidth: layout.editorWidth,
        aiWidth: layout.aiWidth
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [layout.aiWidth, layout.editorWidth]
  );

  const handleResizeMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const delta = event.clientX - resizeState.startX;
      if (resizeState.kind === "editor") {
        setLayout((currentLayout) => ({
          ...currentLayout,
          editorWidth: Math.min(720, Math.max(280, resizeState.editorWidth + delta))
        }));
        return;
      }

      setLayout((currentLayout) => ({
        ...currentLayout,
        aiWidth: Math.min(520, Math.max(260, resizeState.aiWidth - delta))
      }));
    },
    [setLayout]
  );

  const finishResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeStateRef.current) {
      resizeStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div className="app-shell">
      <TopBar
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onManualSnapshot={handleManualSnapshot}
        onFormat={handleFormat}
        onRender={handleRender}
        onToggleAiPanel={handleToggleAiPanel}
        onOpenDocs={handleOpenDocs}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleHistoryPanel={() => {
          setHistoryOpen((currentValue) => !currentValue);
          void loadHistory();
        }}
        theme={theme}
        onToggleTheme={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
        aiCollapsed={layout.aiCollapsed}
      />
      <TemplatesBar onSelectTemplate={handleSelectTemplate} />
      <main className="workbench" style={workbenchStyle}>
        {appError ? (
          <div className="app-error" role="alert">
            <span>{appError}</span>
            <button type="button" onClick={() => setAppError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
        <section className="editor-pane" aria-label="Mermaid editor">
          <div className="editor-stack">
            <CodeEditor
              value={content}
              onChange={setContent}
              theme={theme}
              autoUpdate={autoUpdate}
              onToggleAutoUpdate={handleToggleAutoUpdate}
              onFormat={handleFormat}
              onRender={handleRender}
              onOpenDocs={handleOpenDocs}
              editorNotice={editorNotice}
              onCursorPositionChange={setCursorPosition}
              selectedSourceSpan={selectedSourceSpan}
              onLineFocus={handleEditorLineFocus}
              onSelectionTextChange={setEditorSelectionText}
            />
            <SnippetsPanel
              enabled={snippetsEnabled}
              selectedNodeLabel={selectedAstItem?.kind !== "edge" ? selectedAstItem?.label ?? null : null}
              onInsertSnippet={addSnippet}
            />
          </div>
        </section>
        <div
          className="resize-handle resize-handle--editor"
          role="separator"
          aria-label="Resize editor"
          onPointerDown={(event) => startResize("editor", event)}
          onPointerMove={handleResizeMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        />
        <section className="canvas-pane" aria-label="Mermaid canvas">
          <SelectionToolbar
            item={selectedAstItem}
            connectFromId={connectFromId}
            onRename={handleRenameSelection}
            onConnect={() => {
              const selectedItem = selectedAstItem;
              if (selectedItem && selectedItem.kind !== "edge") {
                setConnectFromId((currentValue) => (currentValue === selectedItem.id ? null : selectedItem.id));
                showEditorNotice("Select target node");
              }
            }}
            onDuplicate={handleDuplicateSelection}
            onDelete={handleDeleteSelection}
            onShapeChange={handleShapeChange}
            onColorChange={handleColorChange}
          />
          <MermaidCanvas
            code={canvasContent}
            theme={theme}
            diagramTheme={diagramTheme}
            layoutHints={layoutHints}
            ast={canvasAst}
            selectedAstId={historyPreview ? null : selectedAstId}
            selectionEnabled={!historyPreview && canvasAst.editable}
            connectFromId={connectFromId}
            onDiagramThemeChange={setDiagramTheme}
            onDirectionChange={handleDirectionChange}
            onDropSnippet={addSnippet}
            onMoveNode={handleMoveNode}
            onSelectAstItem={handleCanvasSelect}
          />
          {historyPreview ? (
            <div className="history-preview-banner">
              <span>Previewing snapshot #{historyPreview.snapshot.id}</span>
              <button type="button" onClick={handleRestoreSnapshot}>
                Restore
              </button>
              <button type="button" onClick={() => setHistoryPreview(null)}>
                Exit Preview
              </button>
            </div>
          ) : null}
        </section>
        <div
          className="resize-handle resize-handle--ai"
          role="separator"
          aria-label="Resize AI panel"
          onPointerDown={(event) => startResize("ai", event)}
          onPointerMove={handleResizeMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        />
        <aside className={`ai-rail${layout.aiCollapsed ? " ai-rail--collapsed" : ""}`} aria-label="AI panel">
          <button
            className="rail-button"
            type="button"
            title={layout.aiCollapsed ? "Open AI panel" : "Collapse AI panel"}
            onClick={handleToggleAiPanel}
          >
            <MessageSquare size={18} />
            {!layout.aiCollapsed ? <span>AI</span> : null}
            {layout.aiCollapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
          {!layout.aiCollapsed ? (
            <AiPanel
              appTheme={theme}
              provider={aiProvider}
              model={aiModel}
              capability={aiCapability}
              prompt={aiPrompt}
              code={content}
              selectedText={editorSelectionText}
              renderError={renderError}
              response={aiResponse}
              proposedCode={aiProposedCode}
              loading={aiLoading}
              history={aiHistory}
              onCapabilityChange={setAiCapability}
              onPromptChange={setAiPrompt}
              onRun={handleRunAi}
              onCancel={handleCancelAi}
              onApply={handleApplyAiProposal}
              onClearProposal={() => setAiProposedCode(null)}
            />
          ) : null}
        </aside>
        {historyOpen ? (
          <HistoryPanel
            snapshots={historySnapshots}
            selectedSnapshotId={historyPreview?.snapshot.id ?? null}
            loading={historyLoading}
            snapshotStatus={snapshotStatus}
            onClose={() => {
              setHistoryOpen(false);
              setHistoryPreview(null);
            }}
            onRefresh={() => void loadHistory()}
            onManualSnapshot={handleManualSnapshot}
            onSelectSnapshot={handleSelectSnapshot}
            onRestoreSnapshot={handleRestoreSnapshot}
          />
        ) : null}
        <SettingsPanel
          open={settingsOpen}
          theme={theme}
          snippetsEnabled={snippetsEnabled}
          autoUpdate={autoUpdate}
          aiProvider={aiProvider}
          aiModel={aiModel}
          aiApiKey={aiApiKey}
          ollamaModels={ollamaModels}
          ollamaModelsLoading={ollamaModelsLoading}
          ollamaModelsError={ollamaModelsError}
          onClose={() => setSettingsOpen(false)}
          onThemeChange={setTheme}
          onSnippetsEnabledChange={setSnippetsEnabled}
          onAutoUpdateChange={handleToggleAutoUpdate}
          onResetLayout={handleResetLayout}
          onAiProviderChange={handleAiProviderChange}
          onAiModelChange={setAiModel}
          onAiApiKeyChange={handleAiApiKeyChange}
          onRefreshOllamaModels={refreshOllamaModels}
        />
      </main>
      <StatusBar cursorPosition={cursorPosition} snapshotCount={snapshotCount} snapshotStatus={snapshotStatus} />
    </div>
  );
}
