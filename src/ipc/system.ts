import { invoke } from "@tauri-apps/api/core";

export const MERMAID_DOCS_URL = "https://mermaid.js.org/intro/syntax-reference.html";

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await invoke("open_external_url", { url });
}
