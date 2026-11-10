import type { AstItem } from "../types";
import { buildParsedMermaid, lineSpan, makeItemId, normalizeMermaidId, tokenSpan } from "./shared";

const participantPattern = /^\s*(participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?/;
const messagePattern = /^\s*([A-Za-z][\w-]*)\s*[-=x)]+[>)]+\s*([A-Za-z][\w-]*)\s*:?\s*(.*)$/;

export function scanSequence(code: string) {
  const lines = code.split(/\r?\n/);
  const items: AstItem[] = [];
  const participants = new Map<string, AstItem>();

  function addParticipant(lineNumber: number, line: string, participantId: string, startIndex: number, label?: string) {
    const normalizedId = normalizeMermaidId(participantId);
    if (participants.has(normalizedId)) {
      return;
    }

    const item: AstItem = {
      id: makeItemId("sequenceDiagram", "participant", [normalizedId]),
      kind: "participant",
      diagramType: "sequenceDiagram",
      label: label?.trim() || normalizedId,
      sourceId: normalizedId,
      sourceSpan: tokenSpan(lineNumber, startIndex, participantId),
      svgHints: [normalizedId, label?.trim() || normalizedId],
      editable: true
    };
    participants.set(normalizedId, item);
    items.push(item);
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%")) {
      return;
    }

    const participantMatch = line.match(participantPattern);
    if (participantMatch) {
      addParticipant(lineNumber, line, participantMatch[2], line.indexOf(participantMatch[2]), participantMatch[3]);
      return;
    }

    const messageMatch = line.match(messagePattern);
    if (!messageMatch) {
      return;
    }

    const sourceId = normalizeMermaidId(messageMatch[1]);
    const targetId = normalizeMermaidId(messageMatch[2]);
    addParticipant(lineNumber, line, sourceId, line.indexOf(messageMatch[1]));
    addParticipant(lineNumber, line, targetId, line.indexOf(messageMatch[2]));

    const label = messageMatch[3]?.trim() ?? "";
    const labelStart = label ? line.lastIndexOf(label) : -1;
    items.push({
      id: makeItemId("sequenceDiagram", "edge", [sourceId, targetId, lineNumber]),
      kind: "edge",
      diagramType: "sequenceDiagram",
      label,
      sourceId,
      targetId,
      sourceSpan: lineSpan(lineNumber, line),
      labelSpan: labelStart >= 0 ? tokenSpan(lineNumber, labelStart, label) : undefined,
      svgHints: [sourceId, targetId, label].filter(Boolean),
      editable: true
    });
  });

  return buildParsedMermaid("sequenceDiagram", items);
}

