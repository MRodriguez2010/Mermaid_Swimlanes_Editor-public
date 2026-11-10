import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";

let initialized = false;
let renderCount = 0;
let activeRenderToken = 0;
let lastRenderedCode = "";

function ensureMermaid() {
  if (initialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "dark"
  });

  initialized = true;
}

export async function renderPreview({ container, errorElement, code }) {
  ensureMermaid();

  errorElement.hidden = true;
  errorElement.textContent = "";

  if (!code.trim()) {
    activeRenderToken += 1;
    lastRenderedCode = "";
    container.innerHTML = '<div class="preview-placeholder">Generated Mermaid output will appear here.</div>';
    return;
  }

  if (code === lastRenderedCode) {
    return;
  }

  const renderToken = ++activeRenderToken;

  try {
    renderCount += 1;
    const renderId = `mermaid-swimlane-${renderCount}`;
    const { svg } = await mermaid.render(renderId, code);
    if (renderToken !== activeRenderToken) {
      return;
    }
    container.innerHTML = svg;
    lastRenderedCode = code;
  } catch (error) {
    if (renderToken !== activeRenderToken) {
      return;
    }
    lastRenderedCode = "";
    container.innerHTML = '<div class="preview-placeholder">Preview unavailable. Fix the Mermaid output and try again.</div>';
    errorElement.hidden = false;
    errorElement.textContent = error instanceof Error ? error.message : String(error);
  }
}
