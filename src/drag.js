function isInteractiveTarget(target) {
  return Boolean(target.closest("input, textarea, button, form"));
}

function hasExpectedDragHandle(target, expectedKind) {
  const handle = target.closest("[data-drag-handle]");
  return Boolean(handle && handle.dataset.dragHandle === expectedKind);
}

function clearDropTargets(container) {
  container.querySelectorAll(".lane-drop-target, .task-drop-target").forEach((element) => {
    element.classList.remove("lane-drop-target", "task-drop-target");
  });
}

function clearDragClasses(container) {
  container.querySelectorAll(".is-dragging").forEach((element) => {
    element.classList.remove("is-dragging");
  });
}

function resolveLaneDropTarget(event, dragState) {
  const laneCard = event.target.closest("[data-lane-id][data-lane-index]");
  if (!laneCard) {
    return null;
  }

  const targetIndex = Number(laneCard.dataset.laneIndex);
  if (!Number.isInteger(targetIndex)) {
    return null;
  }

  const rect = laneCard.getBoundingClientRect();
  const placeAfter = event.clientX > rect.left + rect.width / 2;
  let nextIndex = targetIndex + (placeAfter ? 1 : 0);

  if (nextIndex > dragState.sourceIndex) {
    nextIndex -= 1;
  }

  return {
    laneCard,
    nextIndex
  };
}

function resolveTaskDropTarget(event, dragState) {
  const taskList = event.target.closest("[data-lane-dropzone='tasks']");
  if (!taskList) {
    return null;
  }

  const laneId = taskList.dataset.laneId;
  if (!laneId) {
    return null;
  }

  const taskCards = [...taskList.querySelectorAll("[data-task-id]")].filter(
    (card) => card.dataset.taskId !== dragState.taskId
  );

  let nextIndex = taskCards.length;
  for (const [index, card] of taskCards.entries()) {
    const rect = card.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      nextIndex = index;
      break;
    }
  }

  return {
    laneId,
    taskList,
    nextIndex
  };
}

export function createDragController({ container, onLaneReorder, onTaskMove }) {
  let dragState = null;

  function handleDragStart(event) {
    const taskCard = event.target.closest("[data-task-id]");
    if (taskCard && !isInteractiveTarget(event.target) && hasExpectedDragHandle(event.target, "task")) {
      dragState = {
        type: "task",
        taskId: taskCard.dataset.taskId,
        sourceLaneId: taskCard.dataset.laneId,
        sourceIndex: Number(taskCard.dataset.taskIndex)
      };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragState.taskId);
      requestAnimationFrame(() => taskCard.classList.add("is-dragging"));
      return;
    }

    const laneCard = event.target.closest("[data-lane-id][data-lane-index]");
    if (laneCard && !isInteractiveTarget(event.target) && !event.target.closest("[data-task-id]") && hasExpectedDragHandle(event.target, "lane")) {
      dragState = {
        type: "lane",
        laneId: laneCard.dataset.laneId,
        sourceIndex: Number(laneCard.dataset.laneIndex)
      };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragState.laneId);
      requestAnimationFrame(() => laneCard.classList.add("is-dragging"));
      return;
    }

    event.preventDefault();
  }

  function handleDragOver(event) {
    if (!dragState) {
      return;
    }

    if (dragState.type === "lane") {
      const target = resolveLaneDropTarget(event, dragState);
      if (!target) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropTargets(container);
      target.laneCard.classList.add("lane-drop-target");
      return;
    }

    const target = resolveTaskDropTarget(event, dragState);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDropTargets(container);
    target.taskList.classList.add("task-drop-target");
  }

  function handleDragEnter(event) {
    if (!dragState) {
      return;
    }

    const target =
      dragState.type === "lane"
        ? resolveLaneDropTarget(event, dragState)
        : resolveTaskDropTarget(event, dragState);

    if (!target) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event) {
    if (!dragState) {
      return;
    }

    event.preventDefault();

    if (dragState.type === "lane") {
      const target = resolveLaneDropTarget(event, dragState);
      clearDropTargets(container);
      if (!target || target.nextIndex === dragState.sourceIndex) {
        dragState = null;
        clearDragClasses(container);
        return;
      }
      onLaneReorder(dragState.sourceIndex, target.nextIndex);
      dragState = null;
      return;
    }

    const target = resolveTaskDropTarget(event, dragState);
    clearDropTargets(container);
    if (!target) {
      dragState = null;
      clearDragClasses(container);
      return;
    }

    onTaskMove({
      taskId: dragState.taskId,
      sourceLaneId: dragState.sourceLaneId,
      targetLaneId: target.laneId,
      targetIndex: target.nextIndex
    });
    dragState = null;
  }

  function handleDragEnd() {
    dragState = null;
    clearDropTargets(container);
    clearDragClasses(container);
  }

  container.addEventListener("dragstart", handleDragStart);
  container.addEventListener("dragenter", handleDragEnter);
  container.addEventListener("dragover", handleDragOver);
  container.addEventListener("drop", handleDrop);
  container.addEventListener("dragend", handleDragEnd);

  return {
    destroy() {
      container.removeEventListener("dragstart", handleDragStart);
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragend", handleDragEnd);
      clearDropTargets(container);
      clearDragClasses(container);
      dragState = null;
    }
  };
}
