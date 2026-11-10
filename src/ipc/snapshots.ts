import { invoke } from "@tauri-apps/api/core";

export type SnapshotTrigger = "edit" | "open" | "save" | "manual" | "visual" | "ai" | "restore";

export interface SaveSnapshotInput {
  documentId: string;
  fileName: string;
  filePath: string | null;
  diagramType: string | null;
  content: string;
  trigger: SnapshotTrigger;
  label: string | null;
}

export interface SnapshotMeta {
  id: number;
  documentId: string;
  parentId: number | null;
  kind: "full" | "diff";
  byteSize: number;
  createdAt: number;
  trigger: SnapshotTrigger;
  label: string | null;
  thumbnailPresent: boolean;
}

export interface SnapshotDocument {
  id: string;
  fileName: string;
  filePath: string | null;
  diagramType: string | null;
  content: string;
  modifiedAt: number;
}

interface BrowserSnapshotRecord extends SnapshotMeta {
  content: string;
}

interface BrowserSnapshotState {
  snapshots: BrowserSnapshotRecord[];
  documents: SnapshotDocument[];
}

const browserSnapshotKey = "mermaid-local.browserSnapshots";

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function readBrowserState(): BrowserSnapshotState {
  const rawValue = window.localStorage.getItem(browserSnapshotKey);
  if (!rawValue) {
    return { snapshots: [], documents: [] };
  }

  try {
    return JSON.parse(rawValue) as BrowserSnapshotState;
  } catch {
    return { snapshots: [], documents: [] };
  }
}

function writeBrowserState(state: BrowserSnapshotState) {
  window.localStorage.setItem(browserSnapshotKey, JSON.stringify(state));
}

function upsertBrowserDocument(state: BrowserSnapshotState, input: SaveSnapshotInput, timestamp: number) {
  const document: SnapshotDocument = {
    id: input.documentId,
    fileName: input.fileName,
    filePath: input.filePath,
    diagramType: input.diagramType,
    content: input.content,
    modifiedAt: timestamp
  };
  const nextDocuments = state.documents.filter((item) => item.id !== input.documentId);
  nextDocuments.push(document);
  state.documents = nextDocuments;
}

export async function saveSnapshot(input: SaveSnapshotInput): Promise<SnapshotMeta> {
  if (isTauriRuntime()) {
    return invoke<SnapshotMeta>("save_snapshot", { input });
  }

  const state = readBrowserState();
  const timestamp = Date.now();
  const previousSnapshots = state.snapshots.filter((snapshot) => snapshot.documentId === input.documentId);
  const previous = previousSnapshots[previousSnapshots.length - 1];
  const snapshot: BrowserSnapshotRecord = {
    id: state.snapshots.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
    documentId: input.documentId,
    parentId: previous?.id ?? null,
    kind: "full",
    byteSize: new TextEncoder().encode(input.content).byteLength,
    createdAt: timestamp,
    trigger: input.trigger,
    label: input.label,
    thumbnailPresent: false,
    content: input.content
  };

  state.snapshots.push(snapshot);
  upsertBrowserDocument(state, input, timestamp);
  writeBrowserState(state);
  const { content: _content, ...meta } = snapshot;
  return meta;
}

export async function listSnapshots(documentId: string, limit = 80, offset = 0): Promise<SnapshotMeta[]> {
  if (isTauriRuntime()) {
    return invoke<SnapshotMeta[]>("list_snapshots", { documentId, limit, offset });
  }

  const state = readBrowserState();
  return state.snapshots
    .filter((snapshot) => snapshot.documentId === documentId)
    .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
    .slice(offset, offset + limit)
    .map(({ content: _content, ...meta }) => meta);
}

export async function getSnapshotContent(snapshotId: number): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>("get_snapshot_content", { snapshotId });
  }

  const snapshot = readBrowserState().snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    throw new Error("Snapshot was not found.");
  }
  return snapshot.content;
}

export async function restoreSnapshot(snapshotId: number): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>("restore_snapshot", { snapshotId });
  }

  return getSnapshotContent(snapshotId);
}

export async function getLatestDocument(): Promise<SnapshotDocument | null> {
  if (isTauriRuntime()) {
    return invoke<SnapshotDocument | null>("get_latest_document");
  }

  return (
    readBrowserState().documents.sort((left, right) => right.modifiedAt - left.modifiedAt)[0] ??
    null
  );
}

export async function pruneSnapshots(documentId: string, keepLatest = 1000): Promise<number> {
  if (isTauriRuntime()) {
    return invoke<number>("prune_snapshots", { documentId, keepLatest });
  }

  const state = readBrowserState();
  const matching = state.snapshots
    .filter((snapshot) => snapshot.documentId === documentId)
    .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id);
  const keepIds = new Set(matching.slice(0, keepLatest).map((snapshot) => snapshot.id));
  const before = state.snapshots.length;
  state.snapshots = state.snapshots.filter(
    (snapshot) => snapshot.documentId !== documentId || keepIds.has(snapshot.id)
  );
  writeBrowserState(state);
  return before - state.snapshots.length;
}
