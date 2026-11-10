import { DiffEditor } from "@monaco-editor/react";
import { useState } from "react";
import { Check, Copy, Loader2, Send, Square, X } from "lucide-react";
import type { AiCapability, AiHistoryEntry, AiProvider } from "../../ipc/ai";

interface AiPanelProps {
  appTheme: "dark" | "light";
  provider: AiProvider;
  model: string;
  capability: AiCapability;
  prompt: string;
  code: string;
  selectedText: string;
  renderError: string | null;
  response: string;
  proposedCode: string | null;
  loading: boolean;
  history: AiHistoryEntry[];
  onCapabilityChange: (capability: AiCapability) => void;
  onPromptChange: (prompt: string) => void;
  onRun: () => void;
  onCancel: () => void;
  onApply: () => void;
  onClearProposal: () => void;
}

const primaryCapabilities: Array<{ id: AiCapability; label: string }> = [
  { id: "generate", label: "Generate" },
  { id: "edit", label: "Edit" },
  { id: "explain", label: "Explain" },
  { id: "convert", label: "Convert" },
  { id: "restyle", label: "Restyle" }
];

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for WebViews or browsers that expose the API but deny it.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function AiPanel({
  appTheme,
  provider,
  model,
  capability,
  prompt,
  code,
  selectedText,
  renderError,
  response,
  proposedCode,
  loading,
  history,
  onCapabilityChange,
  onPromptChange,
  onRun,
  onCancel,
  onApply,
  onClearProposal
}: AiPanelProps) {
  const [copied, setCopied] = useState(false);
  const diffTheme = appTheme === "dark" ? "vs-dark" : "light";
  const capabilityButtons = renderError
    ? [{ id: "fix" as const, label: "Fix" }, ...primaryCapabilities]
    : primaryCapabilities;

  const handleCopyResponse = async () => {
    if (!response.trim()) {
      return;
    }

    await copyToClipboard(response);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div>
          <h2>AI</h2>
          <span>{provider} / {model || "model"}</span>
        </div>
      </div>

      <div className="ai-capabilities" aria-label="AI capabilities">
        {capabilityButtons.map((item) => (
          <button
            key={item.id}
            type="button"
            className={capability === item.id ? "is-active" : ""}
            onClick={() => onCapabilityChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {selectedText ? <div className="ai-selection-pill">Selection {selectedText.length} chars</div> : null}
      {renderError ? <button className="ai-fix-banner" type="button" onClick={() => onCapabilityChange("fix")}>Fix current error</button> : null}

      <label className="ai-prompt">
        <span>Prompt</span>
        <textarea value={prompt} rows={5} onChange={(event) => onPromptChange(event.currentTarget.value)} />
      </label>

      <div className="ai-actions">
        <button type="button" onClick={onRun} disabled={loading || !prompt.trim()}>
          {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
          Run
        </button>
        <button type="button" onClick={onCancel} disabled={!loading && !response && !proposedCode}>
          {loading ? <Square size={15} /> : <X size={15} />}
          Cancel
        </button>
      </div>

      <section className="ai-response" aria-live="polite">
        <div className="ai-section-header">
          <h3>Response</h3>
          <button type="button" onClick={handleCopyResponse} disabled={!response.trim()} title="Copy response">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div>{loading && !response ? "Streaming..." : response || "Idle"}</div>
      </section>

      {proposedCode ? (
        <section className="ai-diff">
          <div className="ai-diff-header">
            <h3>Diff</h3>
            <div>
              <button type="button" onClick={onApply}>
                <Check size={15} />
                Apply
              </button>
              <button type="button" onClick={onClearProposal}>
                <X size={15} />
                Cancel
              </button>
            </div>
          </div>
          <DiffEditor
            height="220px"
            language="mermaid"
            theme={diffTheme}
            original={code}
            modified={proposedCode}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              renderSideBySide: false,
              scrollBeyondLastLine: false,
              wordWrap: "on"
            }}
          />
        </section>
      ) : null}

      <section className="ai-history" aria-label="AI history">
        <h3>History</h3>
        {history.length === 0 ? <div className="ai-history-empty">No messages</div> : null}
        {history.slice(0, 8).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              onCapabilityChange(entry.capability);
              onPromptChange(entry.prompt);
            }}
          >
            <span>{entry.capability}</span>
            <small>{entry.prompt}</small>
          </button>
        ))}
      </section>
    </div>
  );
}
