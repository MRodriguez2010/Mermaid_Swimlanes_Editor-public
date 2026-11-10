import type { AstItem } from "../types";
import { buildParsedMermaid, lineSpan, makeItemId, normalizeMermaidId, tokenSpan } from "./shared";

const statePattern = /^\s*state\s+(.+?)\s+as\s+([A-Za-z][\w-]*)/;
const transitionPattern = /^\s*(\[\*\]|[A-Za-z][\w-]*)\s*-->\s*(\[\*\]|[A-Za-z][\w-]*)(?:\s*:\s*(.+))?/;

export function scanStateDiagram(code: string, diagramType: "stateDiagram" | "stateDiagram-v2") {
  const lines = code.split(/\r?\n/);
  const items: AstItem[] = [];
  const states = new Set<string>();

  function addState(lineNumber: number, line: string, stateId: string, startIndex: number, label?: string) {
    const normalizedId = normalizeMermaidId(stateId);
    if (normalizedId === "[*]" || states.has(normalizedId)) {
      return;
    }
    states.add(normalizedId);
    items.push({
      id: makeItemId(diagramType, "state", [normalizedId]),
      kind: "state",
      diagramType,
      label: label?.trim() || normalizedId,
      sourceId: normalizedId,
      sourceSpan: tokenSpan(lineNumber, startIndex, stateId),
      svgHints: [normalizedId, label?.trim() || normalizedId],
      editable: true
    });
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const stateMatch = line.match(statePattern);
    if (stateMatch) {
      addState(lineNumber, line, stateMatch[2], line.indexOf(stateMatch[2]), stateMatch[1]);
      return;
    }

    const transitionMatch = line.match(transitionPattern);
    if (!transitionMatch) {
      return;
    }

    const sourceId = normalizeMermaidId(transitionMatch[1]);
    const targetId = normalizeMermaidId(transitionMatch[2]);
    addState(lineNumber, line, sourceId, line.indexOf(transitionMatch[1]));
    addState(lineNumber, line, targetId, line.lastIndexOf(transitionMatch[2]));
    items.push({
      id: makeItemId(diagramType, "edge", [sourceId, targetId, lineNumber]),
      kind: "edge",
      diagramType,
      label: transitionMatch[3]?.trim() ?? "",
      sourceId,
      targetId,
      sourceSpan: lineSpan(lineNumber, line),
      svgHints: [sourceId, targetId, transitionMatch[3]?.trim() ?? ""].filter(Boolean),
      editable: true
    });
  });

  return buildParsedMermaid(diagramType, items);
}

