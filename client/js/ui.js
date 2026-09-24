// Small DOM toolkit: element builder, toasts, modals, tooltips, screen switching.
import { sfx } from './audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// el('div.a.b#id', {attrs/on*}, children...)
export function el(spec, attrs, ...children) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
  const node = document.createElement(m[1] || 'div');
  const rest = m[2] || '';
  for (const part of rest.match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') node.classList.add(part.slice(1));
    else node.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'cls') node.className += ' ' + v;
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  append(node, children);
  return node;
}
function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
export function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------------------------------------------------------------------------
export function toast(text, kind = '', life = 2.4) {
  const root = $('#toast-root');
  const t = el('div.toast' + (kind ? '.' + kind : ''), { style: { '--life': life + 's' } }, text);
  root.appendChild(t);
  while (root.children.length > 4) root.firstChild.remove();
  setTimeout(() => t.remove(), (life + 0.5) * 1000);
}

// ---------------------------------------------------------------------------
let modalStack = [];
export function modal({ title, body, actions = [{ label: 'OK', value: true, cls: 'gold' }], closable = true, width, cls = '', onOpen } = {}) {
  return new Promise((resolve) => {
    const box = el('div.modal.win' + (cls ? '.' + cls : ''), { style: width ? { width } : null, role: 'dialog', 'aria-modal': 'true' });
    if (title) box.appendChild(el('div.win-title', title));
    const bodyEl = el('div.modal-body.scroll');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    box.appendChild(bodyEl);
    const back = el('div.modal-back', box);
    const close = (v) => {
      if (back.dataset.closing) return;
      back.dataset.closing = '1';
      back.classList.add('closing');
      modalStack = modalStack.filter((m) => m !== entry);
      setTimeout(() => back.remove(), 170);
      resolve(v);
    };
    const entry = { close, closable };
    if (actions && actions.length) {
      const row = el('div.modal-actions');
      for (const a of actions) {
        const b = el('button.btn' + (a.cls ? '.' + a.cls.split(' ').join('.') : ''), { onclick: () => { sfx(a.value === false || a.value === null ? 'cancel' : 'confirm'); if (a.onClick) { const r = a.onClick(close); if (r === false) return; } close(a.value); } }, a.label);
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    if (closable) back.addEventListener('pointerdown', (e) => { if (e.target === back) { sfx('cancel'); close(null); } });
    modalStack.push(entry);
    $('#overlay-root').appendChild(back);
    sfx('open');
    if (onOpen) onOpen(box, close);
    setTimeout(() => { const f = box.querySelector('input, .btn.gold'); if (f) f.focus(); }, 60);
  });
}
export function closeTopModal() {
  const top = modalStack[modalStack.length - 1];
  if (top && top.closable) { top.close(null); return true; }
  return false;
}
export function hasModal() { return modalStack.length > 0; }
export function confirmBox(text, { yes = 'Yes', no = 'Cancel', title = 'Confirm', danger = false } = {}) {
  return modal({ title, body: el('p', { style: { margin: '6px 0 0', maxWidth: '420px', lineHeight: 1.5 } }, text), actions: [{ label: no, value: false, cls: 'ghost' }, { label: yes, value: true, cls: danger ? 'red' : 'gold' }] });
}
export function promptBox(text, { value = '', placeholder = '', title = 'Enter', max = 24 } = {}) {
  const input = el('input.field', { value, placeholder, maxlength: max, style: { width: '100%', marginTop: '10px' } });
  const body = el('div', el('p', { style: { margin: 0 } }, text), input);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.closest('.modal').querySelector('.btn.gold').click(); } });
  return modal({ title, body, actions: [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'OK', cls: 'gold', onClick: (close) => { close(input.value.trim()); return false; } }] });
}

// ---------------------------------------------------------------------------
// Tooltips: any element with data-tip (HTML allowed) gets a floating tooltip.
let tipEl = null;
let tipTarget = null;
export function initTooltips() {
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === tipTarget) return;
    hideTip();
    if (!t || e.pointerType === 'touch') return;
    tipTarget = t;
    tipEl = el('div.tooltip', { html: t.dataset.tip });
    document.body.appendChild(tipEl);
    placeTip(e);
  });
  document.addEventListener('pointermove', (e) => { if (tipEl) placeTip(e); });
  document.addEventListener('pointerdown', hideTip);
}
function placeTip(e) {
  const r = tipEl.getBoundingClientRect();
  let x = e.clientX + 16;
  let y = e.clientY + 18;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 12;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 12;
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
}
export function hideTip() { if (tipEl) tipEl.remove(); tipEl = null; tipTarget = null; }

// ---------------------------------------------------------------------------
let current = null;
export function setScreen(node, { wipe = true } = {}) {
  hideTip();
  const app = $('#app');
  if (current && current.cleanup) try { current.cleanup(); } catch (e) { console.error(e); }
  if (wipe) {
    const w = el('div.wipe');
    document.body.appendChild(w);
    setTimeout(() => w.remove(), 800);
  }
  clear(app);
  node.classList.add('screen');
  app.appendChild(node);
  current = node;
  return node;
}

// Floating combat text at a screen position
export function floatText(x, y, text, cls = '') {
  const layer = $('#float-layer');
  const parts = cls.split(' ').filter(Boolean);
  const isNum = parts[0] === 'num';
  const n = document.createElement('div');
  n.className = (isNum ? 'float-num ' : 'float-text ') + parts.filter((p) => p !== 'num').join(' ');
  n.style.left = x + 'px';
  n.style.top = y + 'px';
  n.textContent = text;
  layer.appendChild(n);
  setTimeout(() => n.remove(), 2200);
  return n;
}

export function fmt(n) { return Number(n).toLocaleString(); }
