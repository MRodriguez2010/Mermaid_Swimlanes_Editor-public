import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type AiProvider = "ollama" | "openai" | "anthropic";
export type AiCapability = "generate" | "fix" | "edit" | "explain" | "convert" | "restyle";
export type AiStreamKind = "start" | "chunk" | "done" | "cancelled" | "error";

export interface AiRequest {
  requestId: string;
  documentId: string;
  provider: AiProvider;
  model: string;
  capability: AiCapability;
  prompt: string;
  code: string;
  selectedText: string | null;
  renderError: string | null;
  apiKey: string | null;
}

export interface AiResponse {
  provider: AiProvider;
  model: string;
  response: string;
  proposedCode: string | null;
}

export interface AiStreamEvent {
  requestId: string;
  kind: AiStreamKind;
  content: string | null;
  response: AiResponse | null;
  error: string | null;
}

export interface AiHistoryEntry {
  id: string;
  documentId: string;
  capability: AiCapability;
  provider: AiProvider;
  model: string;
  prompt: string;
  response: string;
  proposedCode: string | null;
  createdAt: number;
}

export interface OllamaModel {
  name: string;
  model: string;
  modifiedAt: string | null;
  size: number | null;
  family: string | null;
  parameterSize: string | null;
  quantizationLevel: string | null;
}

export interface SaveAiHistoryInput {
  documentId: string;
  provider: AiProvider;
  model: string;
  capability: AiCapability;
  prompt: string;
  response: string;
  proposedCode: string | null;
}

interface RunAiOptions {
  onEvent?: (event: AiStreamEvent) => void;
  signal?: AbortSignal;
}

const browserApiKeysStorageKey = "mermaid-local.aiApiKeys";
const browserHistoryStorageKey = "mermaid-local.aiHistory.records";
const fallbackOllamaModels: OllamaModel[] = [
  {
    name: "qwen2.5-coder:14b",
    model: "qwen2.5-coder:14b",
    modifiedAt: null,
    size: null,
    family: "qwen2",
    parameterSize: "14.8B",
    quantizationLevel: null
  }
];

const canonicalSystemPrompt = `You are Mermaid Local's diagram assistant.

Rules:
- Work only with Mermaid diagram text and concise explanations.
- Never claim a diagram was applied; the app will show a diff and the user decides.
- Preserve user comments and existing Mermaid syntax where possible.
- Prefer simple, valid Mermaid over clever syntax.
- Do not use telemetry, remote project context, or hidden state.
- For generation or edits, return the complete replacement Mermaid document.
- For explanations, return plain text and do not include a replacement document.`;

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeAbortError() {
  const error = new Error("AI request was cancelled.");
  error.name = "AbortError";
  return error;
}

function wait(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(makeAbortError());
  }

  return new Promise<void>((resolve, reject) => {
    let timeoutId: number;

    function cleanup() {
      signal?.removeEventListener("abort", abortHandler);
    }

    function abortHandler() {
      window.clearTimeout(timeoutId);
      cleanup();
      reject(makeAbortError());
    }

    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener("abort", abortHandler, { once: true });
  });
}

function summarizePrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 80) || "AI request";
}

function fallbackFlowchart(prompt: string) {
  const title = summarizePrompt(prompt).replace(/["\\]/g, "");
  return `flowchart TB
  Start([${title}]) --> Draft[Draft Mermaid]
  Draft --> Review{Review needed?}
  Review -->|Yes| Revise[Revise diagram]
  Review -->|No| Done([Done])`;
}

function restyleCode(code: string) {
  const trimmed = code.trim() || fallbackFlowchart("new diagram");
  if (/^\s*style\s+/m.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}
  classDef aiAccent fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#0f172a
  class Start,Draft,Review,Revise,Done aiAccent`;
}

function fixCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed) {
    return fallbackFlowchart("fixed diagram");
  }

  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  if (/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|timeline|gantt|mindmap|pie|block-beta)\b/.test(firstLine)) {
    return trimmed;
  }

  return `flowchart TB
  A[Recovered start] --> B[${firstLine.replace(/[[\]{}()]/g, "") || "Recovered node"}]`;
}

function convertCode(prompt: string, code: string) {
  if (/sequence/i.test(prompt)) {
    return `sequenceDiagram
  participant U as User
  participant A as App
  U->>A: Open diagram
  A-->>U: Show generated sequence`;
  }

  return code.trim() || fallbackFlowchart(prompt);
}

function makeBrowserFallback(input: AiRequest): AiResponse {
  let proposedCode: string | null = null;
  let response = "Prepared a local browser fallback response.";

  if (input.capability === "explain") {
    response = `This diagram appears to be a ${input.code.trim().split(/\s+/)[0] || "Mermaid"} document. The AI panel is in browser fallback mode, so no network call was made.`;
  } else if (input.capability === "generate") {
    proposedCode = fallbackFlowchart(input.prompt);
    response = "Generated a flowchart draft from the prompt.";
  } else if (input.capability === "fix") {
    proposedCode = fixCode(input.code);
    response = "Prepared a syntax-safe replacement candidate.";
  } else if (input.capability === "restyle") {
    proposedCode = restyleCode(input.code);
    response = "Added a simple classDef-based styling candidate.";
  } else if (input.capability === "convert") {
    proposedCode = convertCode(input.prompt, input.code);
    response = "Prepared a conversion candidate.";
  } else {
    proposedCode = `${input.code.trim()}
  %% AI edit: ${summarizePrompt(input.prompt)}`;
    response = "Prepared an edit candidate for review.";
  }

  return {
    provider: input.provider,
    model: input.model,
    response,
    proposedCode
  };
}

function capabilityInstruction(capability: AiCapability) {
  if (capability === "generate") {
    return "Generate a complete Mermaid diagram from the user's prompt.";
  }
  if (capability === "fix") {
    return "Fix Mermaid syntax errors while preserving the user's intent.";
  }
  if (capability === "edit") {
    return "Edit the current Mermaid diagram according to the user's instruction.";
  }
  if (capability === "explain") {
    return "Explain the current Mermaid diagram clearly and briefly.";
  }
  if (capability === "convert") {
    return "Convert the current diagram to the requested Mermaid diagram type.";
  }
  if (capability === "restyle") {
    return "Restyle the current Mermaid diagram using valid classDef, class, or style lines.";
  }

  return "Help with the current Mermaid diagram.";
}

function buildUserPrompt(input: AiRequest) {
  let prompt = `${capabilityInstruction(input.capability)}\n\nUser request:\n${input.prompt.trim()}`;

  if (input.renderError?.trim()) {
    prompt += `\n\nCurrent render error:\n${input.renderError.trim()}`;
  }

  if (input.selectedText?.trim()) {
    prompt += `\n\nSelected Mermaid text:\n\`\`\`mermaid\n${input.selectedText.trim()}\n\`\`\``;
  }

  if (input.code.trim()) {
    prompt += `\n\nCurrent Mermaid document:\n\`\`\`mermaid\n${input.code.trim()}\n\`\`\``;
  }

  if (input.capability === "explain") {
    prompt += "\n\nReturn a concise explanation only.";
  } else {
    prompt += "\n\nReturn the complete replacement Mermaid document. Avoid markdown fences unless needed.";
  }

  return prompt;
}

function stripCodeFence(response: string) {
  const trimmed = response.trim();
  if (!trimmed.startsWith("```")) {
    const allLines = trimmed.split(/\r?\n/);
    for (let index = 0; index < allLines.length; index += 1) {
      const info = allLines[index]?.trimStart() ?? "";
      if (!info.startsWith("```")) {
        continue;
      }

      const endOffset = allLines
        .slice(index + 1)
        .findIndex((line) => line.trimStart().startsWith("```"));
      if (endOffset === -1) {
        continue;
      }

      const candidate = allLines
        .slice(index + 1, index + 1 + endOffset)
        .join("\n")
        .trim();
      if (info.includes("mermaid") || looksLikeMermaidDocument(candidate)) {
        return candidate;
      }
    }

    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines.shift() ?? "";
  if (!firstLine.startsWith("```")) {
    return trimmed;
  }

  let endIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.trimStart().startsWith("```")) {
      endIndex = index;
      break;
    }
  }
  return lines.slice(0, endIndex === -1 ? lines.length : endIndex).join("\n").trim();
}

function looksLikeMermaidDocument(value: string) {
  let inFrontmatter = false;
  let frontmatterChecked = false;
  const firstCodeLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => {
      if (!line || line.startsWith("%%")) {
        return false;
      }

      if (!frontmatterChecked && line === "---") {
        frontmatterChecked = true;
        inFrontmatter = true;
        return false;
      }

      if (inFrontmatter) {
        if (line === "---") {
          inFrontmatter = false;
        }
        return false;
      }

      return true;
    });

  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|timeline|gantt|mindmap|pie|block-beta)\b/.test(
    firstCodeLine ?? ""
  );
}

function makeAiResponse(input: AiRequest, response: string): AiResponse {
  const stripped = stripCodeFence(response);
  const proposedCode =
    input.capability === "explain" ? null : looksLikeMermaidDocument(stripped) ? stripped : null;

  return {
    provider: input.provider,
    model: input.model,
    response,
    proposedCode
  };
}

function chunkText(value: string) {
  return value.match(/.{1,14}(?:\s|$)/g) ?? [value];
}

async function runBrowserFallback(input: AiRequest, options: RunAiOptions = {}) {
  const response = makeBrowserFallback(input);
  options.onEvent?.({
    requestId: input.requestId,
    kind: "start",
    content: null,
    response: null,
    error: null
  });

  for (const chunk of chunkText(response.response)) {
    await wait(100, options.signal);
    options.onEvent?.({
      requestId: input.requestId,
      kind: "chunk",
      content: chunk,
      response: null,
      error: null
    });
  }

  options.onEvent?.({
    requestId: input.requestId,
    kind: "done",
    content: null,
    response,
    error: null
  });

  return response;
}

async function runBrowserOllama(input: AiRequest, options: RunAiOptions = {}) {
  options.onEvent?.({
    requestId: input.requestId,
    kind: "start",
    content: null,
    response: null,
    error: null
  });

  const response = await window.fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      stream: true,
      prompt: `${canonicalSystemPrompt}\n\n${buildUserPrompt(input)}`,
      options: { temperature: 0.2 }
    }),
    signal: options.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let pending = "";
  let output = "";

  function processLine(line: string) {
    if (!line.trim()) {
      return;
    }

    const parsed = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (parsed.done || !parsed.response) {
      return;
    }

    output += parsed.response;
    options.onEvent?.({
      requestId: input.requestId,
      kind: "chunk",
      content: parsed.response,
      response: null,
      error: null
    });
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    let newlineIndex = pending.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = pending.slice(0, newlineIndex).trimEnd();
      pending = pending.slice(newlineIndex + 1);
      processLine(line);
      newlineIndex = pending.indexOf("\n");
    }
  }

  if (pending.trim()) {
    processLine(pending.trimEnd());
  }

  const aiResponse = makeAiResponse(input, output);
  options.onEvent?.({
    requestId: input.requestId,
    kind: "done",
    content: null,
    response: aiResponse,
    error: null
  });
  return aiResponse;
}

export async function cancelAiRequest(requestId: string): Promise<void> {
  if (!requestId.trim()) {
    return;
  }

  if (!isTauriRuntime()) {
    return;
  }

  await invoke("cancel_ai_request", { requestId });
}

export async function runAiRequest(input: AiRequest, options: RunAiOptions = {}): Promise<AiResponse> {
  if (!isTauriRuntime()) {
    if (input.provider === "ollama") {
      try {
        return await runBrowserOllama(input, options);
      } catch (error) {
        if (options.signal?.aborted) {
          throw error;
        }
      }
    }
    return runBrowserFallback(input, options);
  }

  let unlisten: (() => void) | null = null;
  const abortHandler = () => {
    void cancelAiRequest(input.requestId);
  };

  try {
    if (options.onEvent) {
      unlisten = await listen<AiStreamEvent>("ai-stream", (event) => {
        if (event.payload.requestId === input.requestId) {
          options.onEvent?.(event.payload);
        }
      });
    }

    if (options.signal?.aborted) {
      await cancelAiRequest(input.requestId);
      throw makeAbortError();
    }

    options.signal?.addEventListener("abort", abortHandler, { once: true });
    return await invoke<AiResponse>("run_ai_request", { input });
  } finally {
    options.signal?.removeEventListener("abort", abortHandler);
    unlisten?.();
  }
}

export async function saveAiApiKey(provider: AiProvider, apiKey: string): Promise<void> {
  if (!isTauriRuntime()) {
    const apiKeys = readLocalJson<Partial<Record<AiProvider, string>>>(browserApiKeysStorageKey, {});
    if (apiKey.trim()) {
      apiKeys[provider] = apiKey;
    } else {
      delete apiKeys[provider];
    }
    writeLocalJson(browserApiKeysStorageKey, apiKeys);
    return;
  }

  await invoke("save_ai_api_key", { provider, apiKey });
}

export async function getAiApiKey(provider: AiProvider): Promise<string | null> {
  if (!isTauriRuntime()) {
    const apiKeys = readLocalJson<Partial<Record<AiProvider, string>>>(browserApiKeysStorageKey, {});
    return apiKeys[provider] ?? null;
  }

  return invoke<string | null>("get_ai_api_key", { provider });
}

export async function deleteAiApiKey(provider: AiProvider): Promise<void> {
  if (!isTauriRuntime()) {
    const apiKeys = readLocalJson<Partial<Record<AiProvider, string>>>(browserApiKeysStorageKey, {});
    delete apiKeys[provider];
    writeLocalJson(browserApiKeysStorageKey, apiKeys);
    return;
  }

  await invoke("delete_ai_api_key", { provider });
}

function normalizeOllamaModels(value: unknown): OllamaModel[] {
  if (!value || typeof value !== "object" || !("models" in value) || !Array.isArray(value.models)) {
    return [];
  }

  return value.models
    .map((model): OllamaModel | null => {
      if (!model || typeof model !== "object" || !("name" in model) || typeof model.name !== "string") {
        return null;
      }

      const details =
        "details" in model && model.details && typeof model.details === "object"
          ? (model.details as Record<string, unknown>)
          : {};
      return {
        name: model.name,
        model: "model" in model && typeof model.model === "string" ? model.model : model.name,
        modifiedAt: "modified_at" in model && typeof model.modified_at === "string" ? model.modified_at : null,
        size: "size" in model && typeof model.size === "number" ? model.size : null,
        family: typeof details.family === "string" ? details.family : null,
        parameterSize: typeof details.parameter_size === "string" ? details.parameter_size : null,
        quantizationLevel: typeof details.quantization_level === "string" ? details.quantization_level : null
      };
    })
    .filter((model): model is OllamaModel => Boolean(model));
}

export async function listOllamaModels(): Promise<OllamaModel[]> {
  if (!isTauriRuntime()) {
    try {
      const response = await window.fetch("http://localhost:11434/api/tags");
      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }
      const models = normalizeOllamaModels(await response.json());
      return models.length ? models : fallbackOllamaModels;
    } catch {
      return fallbackOllamaModels;
    }
  }

  return invoke<OllamaModel[]>("list_ollama_models");
}

export async function saveAiHistory(input: SaveAiHistoryInput): Promise<AiHistoryEntry> {
  if (!isTauriRuntime()) {
    const record: AiHistoryEntry = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: Date.now()
    };
    const records = readLocalJson<AiHistoryEntry[]>(browserHistoryStorageKey, []);
    writeLocalJson(browserHistoryStorageKey, [record, ...records].slice(0, 500));
    return record;
  }

  return invoke<AiHistoryEntry>("save_ai_history", { input });
}

export async function listAiHistory(documentId: string, limit = 50): Promise<AiHistoryEntry[]> {
  if (!isTauriRuntime()) {
    return readLocalJson<AiHistoryEntry[]>(browserHistoryStorageKey, [])
      .filter((entry) => entry.documentId === documentId)
      .slice(0, limit);
  }

  return invoke<AiHistoryEntry[]>("list_ai_history", { documentId, limit });
}
