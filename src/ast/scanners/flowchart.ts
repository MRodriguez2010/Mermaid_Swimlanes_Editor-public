import type { AstItem } from "../types";
import { buildParsedMermaid, lineSpan, makeItemId, normalizeMermaidId, stripMermaidLabelWrapper, tokenSpan } from "./shared";

const nodeIdPattern = "[A-Za-z][\\w:-]*";
const labelPattern = "\\[\\[[^\\]]+\\]\\]|\\(\\([^)]*\\)\\)|\\[\\([^)]*\\)\\]|\\[[^\\]]+\\]|\\([^)]*\\)|\\{[^}]+\\}";
const nodeDefinitionPattern = new RegExp(`(${nodeIdPattern})\\s*(${labelPattern})`, "g");
const edgePattern = new RegExp(
  `^\\s*(${nodeIdPattern})(?:\\s*${labelPattern})?\\s*([-~=ox.]*[-=.]+[->ox.]+)\\s*(?:\\|([^|]*)\\|\\s*)?(${nodeIdPattern})`
);

export function scanFlowchart(code: string, diagramType: "flowchart" | "graph") {
  const lines = code.split(/\r?\n/);
  const items: AstItem[] = [];
  const nodeItems = new Map<string, AstItem>();

  function addNode(lineNumber: number, line: string, nodeId: string, startIndex: number, label?: string, labelSpan?: AstItem["labelSpan"]) {
    const normalizedId = normalizeMermaidId(nodeId);
    const existing = nodeItems.get(normalizedId);
    if (existing?.labelSpan || (existing && !labelSpan)) {
      return existing;
    }

    const item: AstItem = {
      id: makeItemId(diagramType, "node", [normalizedId]),
      kind: "node",
      diagramType,
      label: label ?? normalizedId,
      sourceId: normalizedId,
      sourceSpan: tokenSpan(lineNumber, startIndex, nodeId),
      labelSpan,
      svgHints: [normalizedId, label ?? normalizedId],
      editable: true
    };

    if (existing) {
      const itemIndex = items.findIndex((candidate) => candidate.id === existing.id);
      if (itemIndex >= 0) {
        items[itemIndex] = item;
      }
    } else {
      items.push(item);
    }
    nodeItems.set(normalizedId, item);
    return item;
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%") || trimmed.startsWith("subgraph") || trimmed === "end") {
      return;
    }

    nodeDefinitionPattern.lastIndex = 0;
    for (const match of line.matchAll(nodeDefinitionPattern)) {
      const nodeId = match[1];
      const labelToken = match[2];
      const labelTokenOffset = match.index + match[0].indexOf(labelToken);
      const unwrapped = stripMermaidLabelWrapper(labelToken);
      addNode(lineNumber, line, nodeId, match.index, unwrapped.label, {
        line: lineNumber,
        startCol: labelTokenOffset + unwrapped.prefixLength + 1,
        endCol: labelTokenOffset + labelToken.length - unwrapped.suffixLength + 1
      });
    }

    const edgeMatch = line.match(edgePattern);
    if (!edgeMatch) {
      return;
    }

    const sourceId = normalizeMermaidId(edgeMatch[1]);
    const targetId = normalizeMermaidId(edgeMatch[4]);
    const sourceStart = line.indexOf(edgeMatch[1]);
    const targetStart = line.lastIndexOf(edgeMatch[4]);
    addNode(lineNumber, line, sourceId, sourceStart);
    addNode(lineNumber, line, targetId, targetStart);

    const label = edgeMatch[3]?.trim() ?? "";
    const labelIndex = edgeMatch[3] ? line.indexOf(`|${edgeMatch[3]}|`) + 1 : -1;
    items.push({
      id: makeItemId(diagramType, "edge", [sourceId, targetId, lineNumber]),
      kind: "edge",
      diagramType,
      label,
      sourceId,
      targetId,
      sourceSpan: lineSpan(lineNumber, line),
      labelSpan:
        labelIndex >= 0
          ? {
              line: lineNumber,
              startCol: labelIndex + 1,
              endCol: labelIndex + edgeMatch[3].length + 1
            }
          : undefined,
      svgHints: [`${sourceId}-${targetId}`, `L-${sourceId}-${targetId}`, label].filter(Boolean),
      editable: true
    });
  });

  return buildParsedMermaid(diagramType, items);
}

