export type LayoutHints = Record<string, [number, number]>;

const layoutHintPattern = /^%%\s*mermaid-local-layout:\s*(\{.*\})\s*%%\s*$/m;

export function readLayoutHints(code: string): LayoutHints {
  const match = code.match(layoutHintPattern);
  if (!match) {
    return {};
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, [number, number]] => {
          const value = entry[1];
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            typeof value[0] === "number" &&
            typeof value[1] === "number"
          );
        })
        .map(([key, value]) => [key, [Math.round(value[0]), Math.round(value[1])]])
    );
  } catch {
    return {};
  }
}

export function writeLayoutHint(code: string, nodeId: string, dx: number, dy: number) {
  const hints = readLayoutHints(code);
  hints[nodeId] = [Math.round(dx), Math.round(dy)];
  const hintLine = `%% mermaid-local-layout: ${JSON.stringify(hints)} %%`;

  if (layoutHintPattern.test(code)) {
    return code.replace(layoutHintPattern, hintLine);
  }

  const lines = code.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^(flowchart|graph)\b/.test(line.trim()));
  if (headerIndex >= 0) {
    lines.splice(headerIndex + 1, 0, hintLine);
    return lines.join("\n");
  }

  return `${hintLine}\n${code}`;
}

