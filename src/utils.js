export function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function insertAt(list, index, value) {
  const next = [...list];
  next.splice(index, 0, value);
  return next;
}

export function moveItem(list, fromIndex, toIndex) {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function sanitizeLine(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
}

export function createEmptyElement(tagName, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}
