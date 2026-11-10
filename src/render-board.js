import { createEmptyElement } from "./utils.js";

function buildTaskCard(task, laneId, taskIndex, onTaskUpdate) {
  const card = createEmptyElement("article", "task-card");
  const header = createEmptyElement("div", "task-card__header");
  const title = createEmptyElement("h3", "task-title");
  const dragHandle = createEmptyElement("span", "drag-hint");
  const editButton = createEmptyElement("button", "ghost-button");
  const description = createEmptyElement("p", "task-description");

  card.dataset.taskId = task.id;
  card.dataset.laneId = laneId;
  card.dataset.taskIndex = String(taskIndex);

  title.textContent = task.title;
  dragHandle.draggable = true;
  dragHandle.textContent = "↕ Move task";
  dragHandle.setAttribute("aria-hidden", "true");
  dragHandle.dataset.dragHandle = "task";
  editButton.type = "button";
  editButton.textContent = "Edit";
  description.textContent = task.description || "";

  editButton.addEventListener("click", () => {
    const nextTitle = window.prompt("Task title", task.title);
    if (nextTitle == null) {
      return;
    }

    const nextDescription = window.prompt("Task description", task.description || "");
    if (nextDescription == null) {
      return;
    }

    onTaskUpdate(task.id, {
      title: nextTitle,
      description: nextDescription
    });
  });

  header.append(title, dragHandle, editButton);
  card.append(header, description);
  return card;
}

function buildAddTaskForm(laneId, onAddTask) {
  const form = createEmptyElement("form", "add-task-form");
  const titleInput = createEmptyElement("input", "task-input");
  const descriptionInput = createEmptyElement("textarea", "task-textarea");
  const submitButton = createEmptyElement("button", "primary-button");

  titleInput.type = "text";
  titleInput.name = "title";
  titleInput.placeholder = "Task title";
  titleInput.required = true;

  descriptionInput.name = "description";
  descriptionInput.placeholder = "Optional description";

  submitButton.type = "submit";
  submitButton.textContent = "Add Task";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onAddTask(laneId, {
      title: titleInput.value,
      description: descriptionInput.value
    });
    form.reset();
    titleInput.focus();
  });

  form.append(titleInput, descriptionInput, submitButton);
  return form;
}

function buildLaneCard({ lane, laneIndex, tasks, focusLaneId, onLaneRename, onAddTask, onTaskUpdate }) {
  const card = createEmptyElement("article", "lane-card");
  const header = createEmptyElement("header", "lane-header");
  const titleRow = createEmptyElement("div", "lane-title-row");
  const titleInput = createEmptyElement("input", "lane-title-input");
  const dragHandle = createEmptyElement("span", "drag-hint");
  const meta = createEmptyElement("span", "lane-meta");
  const taskList = createEmptyElement("div", "lane-task-list");

  card.dataset.laneId = lane.id;
  card.dataset.laneIndex = String(laneIndex);
  taskList.dataset.laneDropzone = "tasks";
  taskList.dataset.laneId = lane.id;

  titleInput.type = "text";
  titleInput.value = lane.title;
  titleInput.setAttribute("aria-label", `Lane title for ${lane.title}`);
  if (focusLaneId === lane.id) {
    titleInput.dataset.autofocus = "true";
  }

  dragHandle.draggable = true;
  dragHandle.textContent = "↔ Drag lane";
  dragHandle.setAttribute("aria-hidden", "true");
  dragHandle.dataset.dragHandle = "lane";

  const commitTitle = () => {
    onLaneRename(lane.id, titleInput.value);
  };

  titleInput.addEventListener("blur", commitTitle);
  titleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      titleInput.blur();
    }

    if (event.key === "Escape") {
      titleInput.value = lane.title;
      titleInput.blur();
    }
  });

  meta.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
  titleRow.append(titleInput, dragHandle);

  for (const [taskIndex, task] of tasks.entries()) {
    taskList.append(buildTaskCard(task, lane.id, taskIndex, onTaskUpdate));
  }

  if (tasks.length === 0) {
    const emptyState = createEmptyElement("div", "empty-lane-state");
    emptyState.textContent = "Drop a task here or add one below.";
    taskList.append(emptyState);
  }

  header.append(titleRow, meta);
  card.append(header, taskList, buildAddTaskForm(lane.id, onAddTask));
  return card;
}

export function renderBoard({
  state,
  container,
  focusLaneId,
  getLaneTasks,
  onLaneRename,
  onAddTask,
  onTaskUpdate
}) {
  container.replaceChildren();

  for (const [laneIndex, laneId] of state.laneOrder.entries()) {
    const lane = state.lanes[laneId];
    if (!lane) {
      continue;
    }

    const laneCard = buildLaneCard({
      lane,
      laneIndex,
      tasks: getLaneTasks(state, laneId),
      focusLaneId,
      onLaneRename,
      onAddTask,
      onTaskUpdate
    });

    container.append(laneCard);
  }

  const focusTarget = container.querySelector('[data-autofocus="true"]');
  if (focusTarget) {
    focusTarget.focus();
    focusTarget.select();
  }
}
