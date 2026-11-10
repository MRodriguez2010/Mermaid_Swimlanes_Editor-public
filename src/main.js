import { generateMermaid } from "./codegen.js";
import { createDragController } from "./drag.js";
import { renderBoard } from "./render-board.js";
import {
  addLane,
  addTask,
  createInitialState,
  getLaneTasks,
  moveTask,
  renameLane,
  reorderLanes,
  updateDiagramTitle,
  updateTask,
  validateState
} from "./state.js";
import { renderPreview } from "./preview.js";

const state = {
  value: createInitialState(),
  pendingFocusLaneId: null
};

const elements = {
  board: document.querySelector("#lane-board"),
  diagramTitle: document.querySelector("#diagram-title"),
  addLaneButton: document.querySelector("#add-lane-button"),
  code: document.querySelector("#mermaid-code"),
  preview: document.querySelector("#mermaid-preview"),
  previewError: document.querySelector("#preview-error")
};

const dragController = createDragController({
  container: elements.board,
  onLaneReorder: (fromIndex, toIndex) => commit(reorderLanes(state.value, fromIndex, toIndex)),
  onTaskMove: ({ taskId, sourceLaneId, targetLaneId, targetIndex }) =>
    commit(moveTask(state.value, taskId, sourceLaneId, targetLaneId, targetIndex))
});

function commit(nextState) {
  const validation = validateState(nextState);
  if (!validation.valid) {
    elements.previewError.hidden = false;
    elements.previewError.textContent = validation.errors.join(" ");
    return;
  }

  state.value = nextState;
  void renderApp();
}

function handleAddLane() {
  const nextState = addLane(state.value);
  state.pendingFocusLaneId = nextState.laneOrder.at(-1) ?? null;
  commit(nextState);
}

async function renderApp() {
  elements.diagramTitle.value = state.value.diagramTitle;

  renderBoard({
    state: state.value,
    container: elements.board,
    focusLaneId: state.pendingFocusLaneId,
    getLaneTasks,
    onLaneRename: (laneId, title) => commit(renameLane(state.value, laneId, title)),
    onAddTask: (laneId, taskInput) => commit(addTask(state.value, laneId, taskInput)),
    onTaskUpdate: (taskId, patch) => commit(updateTask(state.value, taskId, patch))
  });

  state.pendingFocusLaneId = null;

  const code = generateMermaid(state.value);
  elements.code.value = code;
  await renderPreview({
    container: elements.preview,
    errorElement: elements.previewError,
    code
  });
}

elements.diagramTitle.addEventListener("input", () => {
  commit(updateDiagramTitle(state.value, elements.diagramTitle.value));
});

elements.addLaneButton.addEventListener("click", handleAddLane);
window.addEventListener("beforeunload", () => dragController.destroy(), { once: true });

void renderApp();
