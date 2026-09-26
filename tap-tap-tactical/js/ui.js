// Tiny DOM helpers for the terminal-styled overlays (menus, vaults, dispensers, archive).

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let root = null;
const stack = [];

export function initUI(node) { root = node; }

// Replace everything in the overlay layer.
export function show(node, { onClose = null, modal = true } = {}) {
  clear();
  return push(node, { onClose, modal });
}
// Modal layers swallow clicks so nothing underneath can be pressed twice.
export function push(node, { onClose = null, modal = true } = {}) {
  const wrap = el('div', { class: modal ? 'layer modal' : 'layer' }, node);
  root.append(wrap);
  stack.push({ wrap, onClose });
  // Only explicit autofocus: a held SPACE from combat must never 'click' a reward card.
  const focus = wrap.querySelector('[autofocus]');
  if (focus) setTimeout(() => focus.focus({ preventScroll: true }), 0);
  return wrap;
}
export function pop() {
  const top = stack.pop();
  if (!top) return false;
  top.wrap.remove();
  if (top.onClose) top.onClose();
  return true;
}
export function clear() {
  while (stack.length) stack.pop().wrap.remove();
}
export const depth = () => stack.length;
export function popTo(n) { while (stack.length > n) pop(); }

export function toast(msg, ms = 1800) {
  const t = el('div', { class: 'toast' }, msg);
  root.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// Type a string into a node, character by character.
export function typeInto(node, str, cps = 60, onDone) {
  let i = 0;
  let cancelled = false;
  const step = () => {
    if (cancelled) return;
    i = Math.min(str.length, i + Math.max(1, Math.round(cps / 30)));
    node.textContent = str.slice(0, i);
    if (i < str.length) setTimeout(step, 33); else if (onDone) onDone();
  };
  step();
  return {
    finish() { cancelled = true; i = str.length; node.textContent = str; if (onDone) onDone(); },
    get done() { return i >= str.length; },
  };
}
