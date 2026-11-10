import { Loader2, Moon, RefreshCw, RotateCcw, Sun, X } from "lucide-react";
import type { AiProvider, OllamaModel } from "../../ipc/ai";

interface SettingsPanelProps {
  open: boolean;
  theme: "dark" | "light";
  snippetsEnabled: boolean;
  autoUpdate: boolean;
  aiProvider: AiProvider;
  aiModel: string;
  aiApiKey: string;
  ollamaModels: OllamaModel[];
  ollamaModelsLoading: boolean;
  ollamaModelsError: string | null;
  onClose: () => void;
  onThemeChange: (theme: "dark" | "light") => void;
  onSnippetsEnabledChange: (enabled: boolean) => void;
  onAutoUpdateChange: () => void;
  onResetLayout: () => void;
  onAiProviderChange: (provider: AiProvider) => void;
  onAiModelChange: (model: string) => void;
  onAiApiKeyChange: (apiKey: string) => void;
  onRefreshOllamaModels: () => void;
}

function formatModelDetail(model: OllamaModel) {
  return [model.parameterSize, model.quantizationLevel, model.family].filter(Boolean).join(" / ");
}

export function SettingsPanel({
  open,
  theme,
  snippetsEnabled,
  autoUpdate,
  aiProvider,
  aiModel,
  aiApiKey,
  ollamaModels,
  ollamaModelsLoading,
  ollamaModelsError,
  onClose,
  onThemeChange,
  onSnippetsEnabledChange,
  onAutoUpdateChange,
  onResetLayout,
  onAiProviderChange,
  onAiModelChange,
  onAiApiKeyChange,
  onRefreshOllamaModels
}: SettingsPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className="settings-panel" aria-label="Settings">
      <div className="settings-header">
        <div>
          <h2>Settings</h2>
          <span>Workspace preferences</span>
        </div>
        <button type="button" title="Close settings" aria-label="Close settings" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <section className="settings-section">
        <h3>General</h3>
        <div className="segmented-control" aria-label="App theme">
          <button type="button" className={theme === "light" ? "is-active" : ""} onClick={() => onThemeChange("light")}>
            <Sun size={15} />
            Light
          </button>
          <button type="button" className={theme === "dark" ? "is-active" : ""} onClick={() => onThemeChange("dark")}>
            <Moon size={15} />
            Dark
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h3>Editor</h3>
        <label className="settings-row">
          <span>Auto-update preview</span>
          <input type="checkbox" checked={autoUpdate} onChange={onAutoUpdateChange} />
        </label>
        <label className="settings-row">
          <span>Show snippets</span>
          <input
            type="checkbox"
            checked={snippetsEnabled}
            onChange={(event) => onSnippetsEnabledChange(event.currentTarget.checked)}
          />
        </label>
      </section>
      <section className="settings-section">
        <h3>AI</h3>
        <div className="settings-grid">
          <label className="settings-field">
            <span>Provider</span>
            <select value={aiProvider} onChange={(event) => onAiProviderChange(event.currentTarget.value as AiProvider)}>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          {aiProvider === "ollama" ? (
            <div className="settings-field">
              <span>Model</span>
              <div className="settings-model-row">
                <select value={aiModel} onChange={(event) => onAiModelChange(event.currentTarget.value)}>
                  {ollamaModels.some((model) => model.name === aiModel) ? null : (
                    <option value={aiModel}>{aiModel || "Select model"}</option>
                  )}
                  {ollamaModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Refresh Ollama models"
                  aria-label="Refresh Ollama models"
                  onClick={onRefreshOllamaModels}
                  disabled={ollamaModelsLoading}
                >
                  {ollamaModelsLoading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                </button>
              </div>
            </div>
          ) : (
            <label className="settings-field">
              <span>Model</span>
              <input value={aiModel} onChange={(event) => onAiModelChange(event.currentTarget.value)} />
            </label>
          )}
        </div>
        {aiProvider === "ollama" ? (
          <div className="settings-ai-note">
            {ollamaModelsError
              ? `Ollama unavailable: ${ollamaModelsError}`
              : ollamaModelsLoading
                ? "Loading installed Ollama models"
                : `${ollamaModels.length} installed model${ollamaModels.length === 1 ? "" : "s"} detected`}
            {ollamaModels.find((model) => model.name === aiModel) ? (
              <small>{formatModelDetail(ollamaModels.find((model) => model.name === aiModel)!)}</small>
            ) : null}
          </div>
        ) : null}
        {aiProvider !== "ollama" ? (
          <label className="settings-field">
            <span>API key</span>
            <input
              type="password"
              value={aiApiKey}
              autoComplete="off"
              onChange={(event) => onAiApiKeyChange(event.currentTarget.value)}
            />
          </label>
        ) : null}
      </section>
      <section className="settings-section">
        <h3>Canvas</h3>
        <button className="settings-command" type="button" onClick={onResetLayout}>
          <RotateCcw size={15} />
          Reset layout
        </button>
      </section>
    </aside>
  );
}
