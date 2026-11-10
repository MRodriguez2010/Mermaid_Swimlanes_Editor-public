import { clamp, cloneState, insertAt, moveItem, sanitizeLine } from "./utils.js";

function normalizeTitle(value, fallback) {
  const trimmed = sanitizeLine(value);
  return trimmed || fallback;
}

function createLaneId(nextLaneId) {
  return `lane_${nextLaneId}`;
}

function createTaskId(nextTaskId) {
  return `task_${nextTaskId}`;
}

export function createInitialState() {
  return {
    diagramTitle: "Project Timeline",
    laneOrder: ["lane_1", "lane_2"],
    lanes: {
      lane_1: {
        id: "lane_1",
        title: "Phase 1",
        taskIds: ["task_1", "task_2"]
      },
      lane_2: {
        id: "lane_2",
        title: "Phase 2",
        taskIds: ["task_3"]
      }
    },
    tasks: {
      task_1: {
        id: "task_1",
        title: "Draft state model",
        description: "Lock down lane/task shape before wiring UI.",
        laneId: "lane_1"
      },
      task_2: {
        id: "task_2",
        title: "Generate Mermaid code",
        description: "Keep output valid as state changes.",
        laneId: "lane_1"
      },
      task_3: {
        id: "task_3",
        title: "Render preview",
        description: "Show diagram updates beside the board.",
        laneId: "lane_2"
      }
    },
    meta: {
      nextLaneId: 3,
      nextTaskId: 4,
      version: 1
    }
  };
}

export function updateDiagramTitle(state, title) {
  const next = cloneState(state);
  next.diagramTitle = sanitizeLine(title);
  return next;
}

export function addLane(state, title = "") {
  const next = cloneState(state);
  const laneId = createLaneId(next.meta.nextLaneId);
  const fallback = `New Lane ${next.meta.nextLaneId}`;

  next.laneOrder.push(laneId);
  next.lanes[laneId] = {
    id: laneId,
    title: normalizeTitle(title, fallback),
    taskIds: []
  };
  next.meta.nextLaneId += 1;

  return next;
}

export function renameLane(state, laneId, title) {
  if (!state.lanes[laneId]) {
    return state;
  }

  const next = cloneState(state);
  const currentTitle = next.lanes[laneId].title;
  next.lanes[laneId].title = normalizeTitle(title, currentTitle);
  return next;
}

export function reorderLanes(state, fromIndex, toIndex) {
  const laneCount = state.laneOrder.length;
  if (laneCount < 2 || fromIndex === toIndex) {
    return state;
  }

  const safeFrom = clamp(fromIndex, 0, laneCount - 1);
  const safeTo = clamp(toIndex, 0, laneCount - 1);
  if (safeFrom === safeTo) {
    return state;
  }

  const next = cloneState(state);
  next.laneOrder = moveItem(next.laneOrder, safeFrom, safeTo);
  return next;
}

export function addTask(state, laneId, { title, description = "" }) {
  if (!state.lanes[laneId]) {
    return state;
  }

  const taskTitle = sanitizeLine(title);
  if (!taskTitle) {
    return state;
  }

  const next = cloneState(state);
  const taskId = createTaskId(next.meta.nextTaskId);

  next.tasks[taskId] = {
    id: taskId,
    title: taskTitle,
    description: String(description ?? "").trim(),
    laneId
  };
  next.lanes[laneId].taskIds.push(taskId);
  next.meta.nextTaskId += 1;

  return next;
}

export function updateTask(state, taskId, patch) {
  if (!state.tasks[taskId]) {
    return state;
  }

  const next = cloneState(state);
  const currentTask = next.tasks[taskId];

  if (Object.hasOwn(patch, "title")) {
    const title = sanitizeLine(patch.title);
    if (title) {
      currentTask.title = title;
    }
  }

  if (Object.hasOwn(patch, "description")) {
    currentTask.description = String(patch.description ?? "").trim();
  }

  return next;
}

export function moveTask(state, taskId, sourceLaneId, targetLaneId, targetIndex) {
  if (!state.tasks[taskId] || !state.lanes[sourceLaneId] || !state.lanes[targetLaneId]) {
    return state;
  }

  const next = cloneState(state);
  const sourceList = next.lanes[sourceLaneId].taskIds.filter((id) => id !== taskId);
  const safeIndex = clamp(targetIndex, 0, next.lanes[targetLaneId].taskIds.length);
  const targetListBase = sourceLaneId === targetLaneId ? sourceList : [...next.lanes[targetLaneId].taskIds];

  next.lanes[sourceLaneId].taskIds = sourceList;
  next.lanes[targetLaneId].taskIds = insertAt(targetListBase, safeIndex, taskId);
  next.tasks[taskId].laneId = targetLaneId;

  return next;
}

export function getLaneTasks(state, laneId) {
  const lane = state.lanes[laneId];
  if (!lane) {
    return [];
  }

  return lane.taskIds.map((taskId) => state.tasks[taskId]).filter(Boolean);
}

export function validateState(state) {
  const errors = [];
  const laneIds = new Set(state.laneOrder);
  const listedTaskIds = new Set();

  if (laneIds.size !== state.laneOrder.length) {
    errors.push("laneOrder contains duplicate lane ids.");
  }

  for (const laneId of state.laneOrder) {
    const lane = state.lanes[laneId];
    if (!lane) {
      errors.push(`Missing lane for id ${laneId}.`);
      continue;
    }

    if (!sanitizeLine(lane.title)) {
      errors.push(`Lane ${laneId} has an empty title.`);
    }

    for (const taskId of lane.taskIds) {
      if (listedTaskIds.has(taskId)) {
        errors.push(`Task ${taskId} is listed more than once across lanes.`);
        continue;
      }
      listedTaskIds.add(taskId);

      const task = state.tasks[taskId];
      if (!task) {
        errors.push(`Lane ${laneId} references missing task ${taskId}.`);
        continue;
      }
      if (task.laneId !== laneId) {
        errors.push(`Task ${taskId} is assigned to ${task.laneId} but listed under ${laneId}.`);
      }
      if (!sanitizeLine(task.title)) {
        errors.push(`Task ${taskId} has an empty title.`);
      }
    }
  }

  for (const [taskId, task] of Object.entries(state.tasks)) {
    if (!state.lanes[task.laneId]) {
      errors.push(`Task ${taskId} points to missing lane ${task.laneId}.`);
      continue;
    }
    if (!listedTaskIds.has(taskId)) {
      errors.push(`Task ${taskId} exists in state but is not listed in lane ${task.laneId}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
