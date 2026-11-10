import { getLaneTasks } from "./state.js";
import { sanitizeLine } from "./utils.js";

function sanitizeTimelineField(value, fallback) {
  const sanitized = sanitizeLine(value).replace(/:/g, " -");
  return sanitized || fallback;
}

export function generateMermaid(state) {
  const lines = ["timeline"];
  const diagramTitle = sanitizeLine(state.diagramTitle);

  if (diagramTitle) {
    lines.push(`    title ${diagramTitle}`);
  }

  for (const laneId of state.laneOrder) {
    const lane = state.lanes[laneId];
    if (!lane) {
      continue;
    }

    lines.push(`    section ${sanitizeTimelineField(lane.title, "Untitled Lane")}`);

    const tasks = getLaneTasks(state, laneId);
    if (tasks.length === 0) {
      lines.push("        Waiting for tasks : Add a task in this lane");
      continue;
    }

    for (const task of tasks) {
      const title = sanitizeTimelineField(task.title, "Untitled Task");
      const description = sanitizeTimelineField(task.description, title);
      lines.push(`        ${title} : ${description}`);
    }
  }

  return lines.join("\n");
}
