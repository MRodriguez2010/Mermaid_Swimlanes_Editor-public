import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface MermaidFile {
  path: string;
  content: string;
}

export interface SaveFileInput {
  path: string;
  content: string;
}

export interface SaveAsInput {
  defaultPath: string;
  content: string;
}

const mermaidFilters = [
  {
    name: "Mermaid",
    extensions: ["mmd", "mermaid"]
  }
];

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function openBrowserFile(): Promise<MermaidFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mmd,.mermaid,text/plain";
    input.style.display = "none";

    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) {
          resolve(null);
          return;
        }

        resolve({
          path: file.name,
          content: await file.text()
        });
      },
      { once: true }
    );

    input.addEventListener(
      "cancel",
      () => {
        input.remove();
        resolve(null);
      },
      { once: true }
    );

    document.body.append(input);
    input.click();
  });
}

function downloadBrowserFile(path: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = path.split(/[\\/]/).filter(Boolean).pop() || "diagram.mmd";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function openMermaidFile(): Promise<MermaidFile | null> {
  if (!isTauriRuntime()) {
    return openBrowserFile();
  }

  const selected = await open({
    multiple: false,
    filters: mermaidFilters
  });

  if (typeof selected !== "string") {
    return null;
  }

  const content = await invoke<string>("read_text_file", { path: selected });
  return {
    path: selected,
    content
  };
}

export async function saveMermaidFile({ path, content }: SaveFileInput): Promise<void> {
  if (!isTauriRuntime()) {
    downloadBrowserFile(path, content);
    return;
  }

  await invoke("write_text_file", { path, content });
}

export async function saveMermaidFileAs({ defaultPath, content }: SaveAsInput): Promise<string | null> {
  if (!isTauriRuntime()) {
    const targetPath = defaultPath.trim() || "diagram.mmd";
    downloadBrowserFile(targetPath, content);
    return targetPath;
  }

  const selected = await save({
    defaultPath,
    filters: mermaidFilters
  });

  if (!selected) {
    return null;
  }

  await saveMermaidFile({ path: selected, content });
  return selected;
}
