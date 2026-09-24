// Settings modal and the small always-visible top-right buttons.
import { el, modal, confirmBox, toast } from '../ui.js';
import { setVolumes, getVolumes, sfx } from '../audio.js';
import { getProfile, saveProfile, resetProfile, exportProfile, importProfile } from '../profile.js';

export function topButtons(extra = []) {
  const p = getProfile();
  const mute = el('button.icon-btn', { 'data-tip': 'Mute / unmute (M)', onclick: () => toggleMute(mute) }, p.settings.muted ? '🔇' : '🔊');
  const gear = el('button.icon-btn', { 'data-tip': 'Settings', onclick: () => openSettings() }, '⚙️');
  return el('div.hub-top-right', ...extra, mute, gear);
}
export function toggleMute(btn) {
  const p = getProfile();
  p.settings.muted = !p.settings.muted;
  setVolumes({ muted: p.settings.muted });
  saveProfile();
  if (btn) btn.textContent = p.settings.muted ? '🔇' : '🔊';
  if (!p.settings.muted) sfx('confirm');
}

export function openSettings() {
  const p = getProfile();
  const s = p.settings;
  const slider = (label, key, min, max, step, onInput, fmt = (v) => Math.round(v * 100) + '%') => {
    const out = el('span.muted', fmt(s[key]));
    const input = el('input', { type: 'range', min, max, step, value: s[key], style: { width: '100%' } });
    input.addEventListener('input', () => { s[key] = +input.value; out.textContent = fmt(s[key]); onInput && onInput(s[key]); saveProfile(); });
    return el('label.col', { style: { gap: '4px' } }, el('div.row', { style: { justifyContent: 'space-between' } }, el('b', label), out), input);
  };
  const toggle = (label, key, tip) => {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!s[key];
    input.addEventListener('change', () => { s[key] = input.checked; saveProfile(); sfx('cursor'); });
    return el('label.row', { style: { cursor: 'pointer' }, 'data-tip': tip }, input, el('span', label));
  };
  const server = el('input.field', { value: s.server || '', placeholder: 'Same as this page (default)', style: { width: '100%' } });
  server.addEventListener('change', () => { s.server = server.value.trim(); saveProfile(); });
  const body = el('div.col', { style: { width: 'min(460px, 86vw)', gap: '14px' } },
    slider('Music', 'music', 0, 1, 0.05, (v) => setVolumes({ music: v })),
    slider('Sound Effects', 'sfx', 0, 1, 0.05, (v) => { setVolumes({ sfx: v }); sfx('cursor'); }),
    slider('Animation Speed', 'animSpeed', 0.5, 3, 0.25, (v) => document.documentElement.style.setProperty('--anim', v), (v) => v + '×'),
    toggle('Camera follows the action', 'autoCamera', 'The camera glides to units as they act.'),
    toggle('Auto-retaliate', 'autoRetaliate', 'Your Identities automatically spend 1 MP to strike back when attacked.'),
    toggle('Confirm End Turn if Identities can still act', 'confirmEndTurn'),
    toggle('Show battle hints', 'showHints'),
    el('label.col', { style: { gap: '4px' } }, el('b', 'Online server'), server, el('span.tiny.muted', 'Leave blank when playing on the Knotwood server itself. Example: wss://my-host.example/ws')),
    el('div.row', { style: { flexWrap: 'wrap' } },
      el('button.btn.small.ghost', { onclick: async () => {
        const data = exportProfile();
        try { await navigator.clipboard.writeText(data); toast('Save data copied to clipboard!', 'good'); } catch { modal({ title: 'Your Save Data', body: el('textarea.field', { style: { width: '100%', height: '160px' } }, data) }); }
      } }, '📤 Export Save'),
      el('button.btn.small.ghost', { onclick: async () => {
        const ta = el('textarea.field', { style: { width: '100%', height: '160px' }, placeholder: 'Paste save data here' });
        const ok = await modal({ title: 'Import Save', body: ta, actions: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Import', value: true, cls: 'gold' }] });
        if (!ok) return;
        try { importProfile(ta.value); toast('Save imported! Reloading…', 'good'); setTimeout(() => location.reload(), 800); } catch (e) { toast(e.message, 'bad'); }
      } }, '📥 Import Save'),
      el('button.btn.small.red', { onclick: async () => {
        if (await confirmBox('Erase your collection, decks and Acorns and start over?', { yes: 'Erase Everything', danger: true })) { resetProfile(); location.reload(); }
      } }, '🗑 Reset Profile')));
  void getVolumes;
  return modal({ title: 'Settings', body, actions: [{ label: 'Done', cls: 'gold', value: true }] });
}
