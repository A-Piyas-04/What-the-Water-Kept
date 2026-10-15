/** Tiny DOM helpers. Keeps the UI modules readable without a framework. */

type Attrs = Record<string, string | number | boolean | undefined>;

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
};

export const clear = (node: HTMLElement): void => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

export const show = (node: HTMLElement, visible: boolean, className = 'is-open'): void => {
  node.classList.toggle(className, visible);
};

/** Formats seconds as "34 min" / "1 h 12 min". */
export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${total} s`;
};

export const formatSaveTime = (ms: number): string => {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
};
