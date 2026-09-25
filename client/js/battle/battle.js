// Battle screen: HUD, hand, inspector, targeting, event animations and match flow.
import { el, clear, setScreen, modal, confirmBox, toast, floatText, sleep, esc, hideTip } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import * as FX from '../fx.js';
import { cardEl, showCardModal, statRow, GLOSSARY } from '../cardView.js';
import { Board, colorsFor } from './board.js';
import { LocalMatch } from './controllers.js';
import { Game, viewFor, cheb, STEP_INDEX } from '../../../shared/engine.js';
import { getCard } from '../../../shared/cards.js';
import { STEPS, STEP_NAMES, FORMATS } from '../../../shared/constants.js';
import { getProfile, addPoints, recordResult, firstWinToday, saveProfile } from '../profile.js';
import { topButtons, toggleMute } from '../screens/settings.js';

const EMOTES = [['👋', 'Hello!'], ['😄', 'Nice move!'], ['😮', 'Whoa!'], ['😤', 'Grr…'], ['🙏', 'Good game!']];

// ===========================================================================
export class BattleView {
  // infos: [{ name, avatar }] for every seat; side: this player's board side (S/W/N/E)
  constructor({ seat, side, mode, infos, rival = null, difficulty = null, onAct, onExit, onEmote = null }) {
    this.seat = seat;
    this.side = side;
    this.mode = mode;
    this.infos = infos;
    this.meInfo = infos[seat];
    this.rival = rival;
    this.difficulty = difficulty;
    this.onAct = onAct;
    this.onExit = onExit;
    this.onEmote = onEmote;
    this.sel = null;
    this.busy = false;
    this.queue = Promise.resolve();
    this.newDraws = new Set();
    this.settings = getProfile().settings;
    this.speed = this.settings.animSpeed || 1;
    FX.setFxSpeed(this.speed);
    this.deadline = null;
    this.build();
  }

  wait(ms) { return sleep(ms / this.speed); }

  // -------------------------------------------------------------------------
  build() {
    document.body.classList.add('battle-mode');
    this.board = new Board(this.seat, this.side, {
      onTile: (p, e) => this.onTile(p, e),
      onUnit: (iid, e) => this.onUnit(iid, e),
      onStruct: (iid, e) => this.onStruct(iid, e),
      onLane: (l, e) => this.onLane(l, e),
      onInspect: (iid) => this.inspect(iid),
      onRightClick: () => this.cancelSel(true),
      onHoverEntity: (iid) => this.onHoverEntity(iid),
      onTileHover: (p) => this.onTileHover(p),
    });
    this.root = el('div.battle');
    this.root.appendChild(this.board.stage);
    // HUD
    this.foesBox = el('div.hud.hud-foes');
    this.boxes = {};
    this.infos.forEach((_, q) => {
      if (q === this.seat) return;
      this.boxes[q] = this.playerBox(q);
      this.foesBox.appendChild(this.boxes[q]);
    });
    this.boxes[this.seat] = this.playerBox(this.seat);
    this.meBox = el('div.hud.hud-me', this.boxes[this.seat]);
    this.foeHand = el('div.foe-hand');
    this.hand = el('div.hand');
    this.inspector = el('div.hud.inspector.win.hidden');
    this.hint = el('div.hud.hint-bar.win.hidden');
    this.chainPanel = el('div.hud.chain-panel.win.hidden');
    this.endBtn = el('button.btn.gold.end-turn', { onclick: () => this.endTurnClick() }, 'END TURN');
    this.phaseTrack = el('div.phase-track');
    this.undoBtn = el('button.btn.small.ghost', { onclick: () => this.act({ type: 'undo' }), 'data-tip': 'Undo your last move <span class="kbd">Z</span>' }, '↶ Undo');
    this.menuBtn = el('button.btn.small.ghost', { onclick: () => this.menu() }, '☰ Menu');
    this.timerEl = el('div.timer');
    this.right = el('div.hud.hud-right', this.timerEl, this.phaseTrack, el('div.small-btns', this.undoBtn, this.menuBtn), this.endBtn);
    this.logLines = el('div.log-lines.scroll');
    this.logPanel = el('div.hud.log-panel.win.dark.collapsed', el('span.log-toggle', { onclick: () => this.logPanel.classList.toggle('collapsed'), 'data-tip': 'Battle log <span class="kbd">L</span>' }, '📜'), el('b.tiny', 'BATTLE LOG'), this.logLines);
    this.thinking = el('div.thinking.hidden', 'Thinking', el('i'), el('i'), el('i'));
    const camBar = el('div.cam-help',
      el('button.icon-btn', { 'data-tip': 'Rotate camera <span class="kbd">Q</span>/<span class="kbd">E</span> · Right-drag pans · Middle-drag orbits', onclick: () => this.board.rotateBy(-45) }, '⟲'),
      el('button.icon-btn', { 'data-tip': 'Home view <span class="kbd">C</span>', onclick: () => this.board.resetCam() }, '🎥'),
      el('button.icon-btn', { 'data-tip': 'Whole battlefield <span class="kbd">V</span>', onclick: () => this.board.overview() }, '🗺️'),
      el('button.icon-btn', { 'data-tip': 'Rules & controls <span class="kbd">H</span>', onclick: () => this.help() }, '❓'),
      el('button.icon-btn', { 'data-tip': 'Mute <span class="kbd">M</span>', onclick: (e) => toggleMute(e.currentTarget) }, getProfile().settings.muted ? '🔇' : '🔊'));
    this.foesBox.appendChild(this.thinking);
    this.root.append(this.foesBox, this.meBox, this.hand, this.inspector, this.hint, this.chainPanel, this.right, this.logPanel, camBar, this.foeHand);
    if (this.mode === 'online') {
      const bar = el('div.emote-bar', ...EMOTES.map(([e, t]) => el('button.icon-btn', { 'data-tip': t, onclick: () => this.onEmote && this.onEmote(e) }, e)));
      this.meBox.appendChild(el('div', { style: { marginTop: '6px' } }, bar));
    }
    this.root.cleanup = () => this.dispose();
    setScreen(this.root);
    this.keyHandler = (e) => this.onKey(e);
    addEventListener('keydown', this.keyHandler);
  }
  dispose() {
    this.closed = true;
    removeEventListener('keydown', this.keyHandler);
    this.board.destroy();
    this.board.unbind();
    document.body.classList.remove('battle-mode');
    this.hideHandPreview();
    if (this.timerInt) clearInterval(this.timerInt);
    hideTip();
  }

  playerBox(p) {
    const box = el('div.pbox.win' + (p === this.seat ? '' : '.dark.compact'));
    box.dataset.p = p;
    return box;
  }
  nameOf(p) { return p === this.seat ? 'You' : (this.infos[p] && this.infos[p].name) || 'Player ' + (p + 1); }
  isFoe(p) { return this.view ? this.view.players[p].team !== this.view.players[this.seat].team : p !== this.seat; }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------
  sync(view) {
    this.view = view;
    this.G = new Game(JSON.parse(JSON.stringify(view)));
    this.G.noUndo = true;
    this.board.sync(view, this.G);
    this.renderPlayers();
    this.renderHand();
    this.renderChain();
    this.renderLog();
    this.validateSel();
    this.refreshHighlights();
    this.renderInspector();
    this.renderButtons();
    this.renderHint();
  }
  canInteract() { return !this.busy && this.view && (this.view.phase === 'play' || this.view.phase === 'setup') && this.G.canAct(this.seat); }
  myTurn() { return this.view && this.view.phase === 'play' && this.view.active === this.seat && !this.view.chain.length; }
  mySetup() { return this.view && this.view.phase === 'setup' && this.view.active === this.seat; }

  renderPlayers() {
    const v = this.view;
    const colors = colorsFor(v, this.seat);
    const G = this.G;
    for (const [q, box] of Object.entries(this.boxes)) {
      const p = +q;
      const P = v.players[p];
      const info = this.infos[p] || {};
      clear(box);
      box.style.setProperty('--pcol', colors[p][0]);
      const active = v.active === p && (v.phase === 'play' || v.phase === 'setup');
      box.classList.toggle('active', active);
      box.classList.toggle('out', !!P.eliminated);
      const ally = p !== this.seat && P.team === v.players[this.seat].team;
      const lanes = v.lanes.filter((ln) => ln.ctrl === p).length;
      box.append(
        el('div.avatar.small' + (this.isFoe(p) ? '.foe' : ''), info.avatar || '🙂'),
        el('div',
          el('div.pname', p === this.seat ? (info.name || 'You') : info.name || 'Player', active ? el('span.turn-tag', v.phase === 'setup' ? 'SETUP' : 'TURN') : null, ally ? el('span.team-tag', 'ALLY') : null),
          el('div.pmeta',
            el('span', { 'data-tip': 'Lanes controlled' }, '🚩 ' + lanes),
            el('span', { 'data-tip': 'Structures standing' }, '🏠 ' + G.structsOf(p).length),
            el('span', { 'data-tip': 'Identities on the battlefield' }, '🐾 ' + G.unitsOf(p).length)),
          el('div.pstats',
            el('span', { 'data-tip': 'Cards in deck' }, '🂠 ' + (P.deckCount ?? P.deck.length)),
            el('span', { 'data-tip': 'Cards in hand (maximum 7)' }, '✋ ' + (P.handCount ?? P.hand.length)),
            el('span', { 'data-tip': 'Discard pile — click to view', style: { cursor: 'pointer' }, onclick: () => this.showDiscard(p) }, '🗑 ' + P.discard.length))));
    }
    // opponent hand backs (duels only)
    clear(this.foeHand);
    if (v.players.length === 2) {
      const n = v.players[1 - this.seat].handCount || 0;
      for (let i = 0; i < Math.min(n, 10); i++) this.foeHand.appendChild(cardEl(null, { width: 46, back: true }));
    }
  }

  renderHand() {
    this.hideHandPreview();
    clear(this.hand);
    const P = this.view.players[this.seat];
    const n = P.hand.length;
    const cw = Math.max(92, Math.min(128, innerWidth / 11));
    this.hand.style.setProperty('--overlap', n > 7 ? `-${Math.min(60, (n - 7) * 12 + 24)}px` : '-14px');
    P.hand.forEach((iid, i) => {
      const cardId = this.view.inst[iid] && this.view.inst[iid].cardId;
      if (!cardId) return;
      const playable = this.canInteract() && this.G.canPlay(this.seat, iid);
      const card = getCard(cardId);
      const c = cardEl(cardId, { width: cw, mini: true, variant: variantFor(iid) });
      const wrap = el('div.hc' + (playable ? '.playable' : '.unplayable'), { dataset: { iid } }, c);
      const mid = (n - 1) / 2;
      const rot = (i - mid) * Math.min(5, 34 / Math.max(1, n));
      wrap.style.transform = `translateY(${Math.abs(i - mid) * Math.abs(i - mid) * 1.6}px) rotate(${rot}deg)`;
      if (this.sel && this.sel.kind === 'card' && this.sel.iid === iid) wrap.classList.add('sel');
      if (this.sel && this.sel.kind === 'endPhase') { wrap.classList.add('end-pick'); if (this.sel.discard.has(iid)) wrap.classList.add('discard-mark'); }
      if (this.newDraws.has(iid)) { wrap.classList.add('drawn'); this.newDraws.delete(iid); }
      if (!playable && (this.myTurn() || this.mySetup()) && !(this.sel && this.sel.kind === 'endPhase')) {
        const why = this.whyUnplayable(iid, card);
        if (why) wrap.appendChild(el('div.cost-warn', why));
      }
      wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); showCardModal(cardId, { variant: variantFor(iid) }); });
      this.bindHandCard(wrap, iid, playable);
      wrap.addEventListener('pointerenter', (e) => { sfx('hover'); if (e.pointerType !== 'touch') this.showHandPreview(wrap, cardId, iid); });
      wrap.addEventListener('pointerleave', () => this.hideHandPreview());
      this.hand.appendChild(wrap);
    });
  }
  showHandPreview(wrap, cardId, iid) {
    this.hideHandPreview();
    const w = Math.min(250, innerHeight * 0.3);
    const c = cardEl(cardId, { width: w, variant: variantFor(iid) });
    const r = wrap.getBoundingClientRect();
    const box = el('div.hand-preview', c);
    box.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    box.style.bottom = Math.max(innerHeight - r.top + 8, 190) + 'px';
    document.body.appendChild(box);
    this.handPrev = box;
  }
  hideHandPreview() { if (this.handPrev) { this.handPrev.remove(); this.handPrev = null; } }
  whyUnplayable(iid, card) {
    if (this.view.phase === 'setup') return card.type === 'Zone' ? 'No open Home Lane' : 'Zones only in setup';
    const step = this.G.cardStep(card);
    if (step && STEP_INDEX[this.view.step] > STEP_INDEX[step]) return `${STEP_NAMES[step]} Phase passed`;
    if (card.play && card.play.timing === 'response') return '⚡ Response only';
    if (card.type === 'Identity' && !this.G.summonTiles(this.seat).length) return 'No free Housing';
    if (card.type === 'Structure' && !this.G.structLanes(this.seat).length) return 'No open Lane';
    if (card.type === 'Zone' && !this.G.zoneLanes(this.seat).length) return 'No Lane to claim';
    if ((card.type === 'Equipment' || card.type === 'Consumable') && !this.G.unitsOf(this.seat).length) return 'No Identity';
    return 'No valid target';
  }
  bindHandCard(wrap, iid, playable) {
    let start = null;
    let dragging = false;
    let ghost = null;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
      dragging = false;
      const move = (ev) => {
        if (!start) return;
        if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 12 && playable) {
          dragging = true;
          this.hideHandPreview();
          this.selectCard(iid, true);
          ghost = cardEl(this.view.inst[iid].cardId, { width: 110, mini: true, variant: variantFor(iid) });
          ghost.classList.add('drag-ghost');
          document.body.appendChild(ghost);
        }
        if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
      };
      const up = (ev) => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        if (ghost) ghost.remove();
        if (dragging) {
          // 3D hit-testing can land on the tile layer itself; prefer a real tile/unit in the stack
          const stack = document.elementsFromPoint(ev.clientX, ev.clientY);
          const under = stack.find((n) => n.closest && n.closest('.unit, .structure, .tile, .hand')) || stack[0];
          this.dropOn(under);
        } else if (start) {
          this.clickCard(iid, playable);
        }
        start = null;
        dragging = false;
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }
  dropOn(node) {
    if (!node || !this.sel || this.sel.kind !== 'card') return;
    if (!this.sel.specs.length) { this.commitSel(); return; }
    const unit = node.closest('.unit');
    const st = node.closest('.structure');
    const tile = node.closest('.tile');
    const lane = node.closest('.lane-bg');
    if (unit) return this.onUnit(unit.dataset.iid);
    if (st) return this.onStruct(st.dataset.iid);
    if (tile) return this.onTile({ x: +tile.dataset.x, y: +tile.dataset.y });
    if (node.closest('.board') && this.hoverTile) return this.onTile(this.hoverTile);
    if (lane && lane.dataset.lane !== undefined) return this.onLane(+lane.dataset.lane);
    if (node.closest('.hand')) this.cancelSel();
  }

  renderChain() {
    const v = this.view;
    const p = this.chainPanel;
    if (!v.chain.length || v.phase !== 'play') { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    clear(p);
    const mine = v.priority === this.seat;
    p.appendChild(el('div', el('b', mine ? '⚡ RESPONSE WINDOW' : `⏳ ${this.nameOf(v.priority)} may respond…`)));
    const items = el('div.chain-items');
    v.chain.forEach((it, i) => {
      let text;
      if (it.kind === 'attack') {
        const a = v.units[it.unit], t = v.units[it.target] || v.structs[it.target];
        text = `⚔️ ${a ? getCard(a.cardId).name : '?'} → ${t ? getCard(t.cardId).name : '?'}`;
      } else text = `${getCard(it.cardId)?.emoji || '🃏'} ${getCard(it.cardId)?.name || 'Card'}`;
      const node = el('div.ci' + (it.p === this.seat ? '.me' : '.foe'), { dataset: { idx: i } }, text);
      if (it.cardId) node.addEventListener('contextmenu', (e) => { e.preventDefault(); showCardModal(it.cardId); });
      if (this.sel && this.sel.pendingChain && this.sel.chainOptions && this.sel.chainOptions.includes(i)) {
        node.style.cursor = 'pointer';
        node.style.borderColor = '#ffd76a';
        node.style.boxShadow = '0 0 12px #ffcc33';
        node.addEventListener('click', () => this.addTarget(i));
      }
      items.appendChild(node);
      if (i < v.chain.length - 1) items.appendChild(el('span', '→'));
    });
    p.appendChild(items);
    if (mine) {
      const resp = this.view.players[this.seat].hand.filter((iid) => this.G.canPlay(this.seat, iid));
      const cons = this.G.responseConsumables(this.seat);
      p.appendChild(el('div.tiny.muted', resp.length || cons.length ? 'Play a glowing ⚡Response card, use a ⚡Consumable on one of your Identities, or pass.' : 'No responses available.'));
      if (cons.length) p.appendChild(el('div.row', { style: { gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' } },
        ...cons.map((u) => el('button.btn.small.green', { onclick: () => this.startConsume(u.iid) }, `🧪 ${getCard(u.cardId).name}: ${this.G.def(u.cons).name}`))));
      p.appendChild(el('div', { style: { marginTop: '8px' } }, el('button.btn.gold.small', { onclick: () => this.act({ type: 'pass' }) }, 'Pass ', el('span.kbd', 'Space'))));
    }
  }

  renderLog() {
    const lines = this.view.log.slice(-40);
    clear(this.logLines);
    for (const l of lines) this.logLines.appendChild(el('div' + (l.startsWith('—') ? '.turnline' : ''), l));
    this.logLines.scrollTop = 1e6;
  }

  renderButtons() {
    const v = this.view;
    const my = this.myTurn();
    const setup = this.mySetup();
    this.endBtn.disabled = !(my || setup) || this.busy;
    this.endBtn.classList.toggle('wait', !(my || setup));
    this.endBtn.textContent = v.phase === 'over' ? 'GAME OVER' : setup ? 'READY ✓' : my ? (this.sel && this.sel.kind === 'endPhase' ? 'CONFIRM END' : 'END TURN') : v.chain.length && v.priority === this.seat ? 'RESPOND' : v.phase === 'setup' ? `${this.nameOf(v.active).toUpperCase()} SETTING UP` : v.players[v.active].team === v.players[this.seat].team ? 'ALLY TURN' : 'ENEMY TURN';
    this.endBtn.classList.toggle('glow', (my && !this.hasUsefulActions()) || (setup && !this.G.playableCards(this.seat).length));
    this.undoBtn.classList.toggle('hidden', !(my && v.canUndo));
    this.renderPhases();
  }
  renderPhases() {
    const v = this.view;
    const t = this.phaseTrack;
    clear(t);
    if (v.phase === 'setup') { t.appendChild(el('span.now', { 'data-tip': 'Everyone places Zones into their Home Lanes.' }, 'SETUP')); return; }
    if (v.phase !== 'play') return;
    const cur = STEP_INDEX[v.step];
    const mine = this.myTurn();
    t.appendChild(el('span.past', { 'data-tip': 'Draw Phase: you drew up to 7 cards.' }, 'DRAW'));
    STEPS.forEach((st, i) => {
      const cls = i < cur ? '.past' : i === cur ? '.now' : mine && st !== 'end' ? '.clickable' : '';
      const label = { zone: 'ZONE', build: 'BUILD', summon: 'SUMMON', equip: 'EQUIP', combat: 'MOVE & FIGHT', end: 'END' }[st];
      const node = el('span' + cls, { 'data-tip': `<b>${STEP_NAMES[st]} Phase</b>${mine && i > cur && st !== 'end' ? '<br>Click to skip ahead.' : ''}` }, label);
      if (mine && i > cur && st !== 'end') node.addEventListener('click', () => this.skipTo(st));
      t.appendChild(node);
    });
  }
  async skipTo(step) {
    if (!this.myTurn() || this.busy) return;
    sfx('select');
    while (this.view && STEP_INDEX[this.view.step] < STEP_INDEX[step]) {
      const ok = await this.onAct({ type: 'nextStep' });
      if (ok === false) break;
    }
  }
  hasUsefulActions() {
    const G = this.G;
    if (G.playableCards(this.seat).length) return true;
    for (const u of G.unitsOf(this.seat)) {
      if (u.state === 'done') continue;
      if (G.attackTargets(u).length) return true;
      if (G.moveBudget(u) > 0 && G.reachable(u).size) return true;
    }
    return false;
  }

  renderHint() {
    const h = this.hint;
    let content = null;
    const s = this.sel;
    if (s && (s.kind === 'card' || s.kind === 'ability' || s.kind === 'consume')) {
      const spec = s.specs[s.targets.length];
      const name = s.kind === 'card' ? getCard(this.view.inst[s.iid].cardId).name : s.name;
      if (!spec) content = el('span', `Play ${name}? `, el('button.btn.small.gold', { onclick: () => this.commitSel() }, 'Play'), el('button.btn.small.ghost', { onclick: () => this.cancelSel() }, 'Cancel'));
      else content = el('span', `${name}: ${spec.label || 'Choose a target'} `, el('button.btn.small.ghost', { onclick: () => this.cancelSel() }, 'Cancel'));
    } else if (s && s.kind === 'endPhase') {
      const n = s.discard.size;
      content = el('span', `🌙 End Phase — click cards to discard them (you draw back up to 7 next turn). `,
        el('button.btn.small.gold', { onclick: () => this.confirmEnd() }, n ? `Discard ${n} & End Turn` : 'Keep Hand & End Turn'),
        el('button.btn.small.ghost', { onclick: () => this.cancelSel() }, 'Back'));
    } else if (this.mySetup() && !this.busy) {
      content = el('span', '🏕️ Setup — drag Zone cards onto your glowing Home Lanes, then press ', el('b', 'READY'), '.');
    } else if (this.settings.showHints && this.myTurn() && !this.busy && this.view.round <= 3) {
      const mine = Object.values(this.view.units).filter((u) => u.owner === this.seat);
      const structs = Object.values(this.view.structs).filter((st) => st.owner === this.seat);
      if (!structs.length) content = el('span', '💡 Build a Structure: drag it onto a tile in a Lane you control.');
      else if (!mine.length) content = el('span', '💡 Summon an Identity: drag it onto a glowing tile in a Lane with your Structure.');
      else if (s && s.kind === 'unit' && this.view.units[s.iid]?.owner === this.seat) content = el('span', '💡 Move once (blue tiles), then attack (2 MP each) or use abilities while MP lasts.');
      else content = el('span', '💡 Turn order: Zone → Build → Summon → Equip → Move & Fight → End. Destroy Structures and capture Lanes to eliminate rivals!');
    }
    if (content) { clear(h); h.appendChild(content); h.classList.remove('hidden'); }
    else h.classList.add('hidden');
  }

  // -------------------------------------------------------------------------
  // Selection & targeting
  // -------------------------------------------------------------------------
  validateSel() {
    const s = this.sel;
    if (!s) return;
    if (s.kind === 'unit' && !this.view.units[s.iid] && !this.view.structs[s.iid]) this.sel = null;
    else if (s.kind === 'card' && !this.view.players[this.seat].hand.includes(s.iid)) this.sel = null;
    else if (s.kind === 'endPhase' && !this.myTurn()) this.sel = null;
    else if ((s.kind === 'ability' || s.kind === 'consume') && !this.view.units[s.unit]) this.sel = null;
    else if (s.kind !== 'unit' && !this.canInteract()) this.sel = null;
  }
  selectUnit(iid) {
    this.sel = { kind: 'unit', iid };
    sfx('select');
    this.refreshHighlights();
    this.renderInspector();
    this.renderHint();
  }
  cancelSel(silent = false) {
    if (!this.sel) return;
    if (!silent) sfx('cancel');
    const back = this.sel.kind === 'ability' || this.sel.kind === 'consume' ? { kind: 'unit', iid: this.sel.unit } : null;
    this.sel = back;
    this.refreshHighlights();
    this.renderHand();
    this.renderInspector();
    this.renderHint();
    this.renderChain();
    this.hidePreview();
  }
  clickCard(iid, playable) {
    if (this.sel && this.sel.kind === 'endPhase') {
      const d = this.sel.discard;
      if (d.has(iid)) d.delete(iid); else d.add(iid);
      sfx('select');
      this.renderHand();
      this.renderHint();
      this.renderButtons();
      return;
    }
    if (!playable) {
      sfx('error');
      const cardId = this.view.inst[iid].cardId;
      if (!this.canInteract()) toast(this.view.active === this.seat ? 'Wait for responses to resolve.' : 'Wait for your turn!', 'bad', 1.4);
      else toast(this.whyUnplayable(iid, getCard(cardId)) || "Can't play that now.", 'bad', 1.4);
      return;
    }
    if (this.sel && this.sel.kind === 'card' && this.sel.iid === iid) {
      if (!this.sel.specs.length) this.commitSel();
      else this.cancelSel();
      return;
    }
    this.selectCard(iid);
  }
  selectCard(iid, silent = false) {
    const specs = this.G.playSpecs(iid);
    this.sel = { kind: 'card', iid, specs, targets: [] };
    if (!silent) sfx('card');
    this.refreshHighlights();
    this.renderHand();
    this.renderHint();
    this.renderChain();
  }
  startAbility(unit, key) {
    const u = this.G.unit(unit);
    const entry = this.G.unitAbilities(u).find((a) => a.key === key);
    if (!entry) return;
    const specs = entry.ab.targets || [];
    if (!specs.length) { this.act({ type: 'ability', unit, key, targets: [] }); return; }
    this.sel = { kind: 'ability', unit, key, specs, targets: [], name: entry.name };
    sfx('select');
    this.refreshHighlights();
    this.renderHint();
  }
  startConsume(unit) {
    const u = this.G.unit(unit);
    const d = this.G.def(u.cons);
    const specs = (d.use && d.use.targets) || [];
    if (!specs.length) { this.act({ type: 'consume', unit, targets: [] }); return; }
    this.sel = { kind: 'consume', unit, specs, targets: [], name: d.name };
    sfx('select');
    this.refreshHighlights();
    this.renderHint();
  }
  targetCtx() {
    const s = this.sel;
    if (s.kind === 'card') return { p: this.seat, card: s.iid, targets: s.targets };
    if (s.kind === 'ability') return { p: this.seat, unit: s.unit, targets: s.targets };
    if (s.kind === 'consume') return { p: this.seat, unit: s.unit, card: this.view.units[s.unit].cons, targets: s.targets };
    return null;
  }
  currentOptions() {
    const s = this.sel;
    if (!s || !s.specs) return null;
    const spec = s.specs[s.targets.length];
    if (!spec) return null;
    return { spec, opts: this.G.targetOptions(spec, this.targetCtx()) };
  }
  addTarget(v) {
    const s = this.sel;
    s.targets.push(v);
    sfx('confirm');
    if (s.targets.length >= s.specs.length) this.commitSel();
    else { this.refreshHighlights(); this.renderHint(); this.renderChain(); }
  }
  commitSel() {
    const s = this.sel;
    if (!s) return;
    if (s.kind === 'card') this.act({ type: 'play', iid: s.iid, targets: s.targets });
    else if (s.kind === 'ability') this.act({ type: 'ability', unit: s.unit, key: s.key, targets: s.targets }, { keepUnit: s.unit });
    else if (s.kind === 'consume') this.act({ type: 'consume', unit: s.unit, targets: s.targets }, { keepUnit: s.unit });
  }

  refreshHighlights() {
    const b = this.board;
    b.clearHighlights();
    if (!this.view) return;
    const s = this.sel;
    if (!s) return;
    const G = this.G;
    if (s.kind === 'unit') {
      const u = G.unit(s.iid);
      if (!u) { const st = G.struct(s.iid); if (st) b.entityClass(st.iid, 'pick'); return; }
      b.entityClass(u.iid, 'selected');
      if (u.owner === this.seat && this.canInteract() && !this.view.chain.length) {
        const budget = u.state === 'done' ? u.freeSteps : G.moveBudget(u);
        this.reach = G.reachable(u, budget);
        for (const r of this.reach.values()) { const t = r.path[r.path.length - 1]; b.tileClass(t, u.state === 'done' ? 'free' : 'move'); b.tileClass(t, 'move'); }
        this.rangeFrom(u, u);
        for (const t of G.attackTargets(u)) b.entityClass(t, 'target');
      } else if (u.owner !== this.seat) {
        // show the enemy's threat zone
        const ap = G.stat(u, 'ap', { activation: true });
        const rp = G.stat(u, 'rp');
        for (const t of b.around(u, ap + rp)) b.tileClass(t, 'threat');
      }
      return;
    }
    if (s.kind === 'endPhase') return;
    const co = this.currentOptions();
    if (!co) return;
    const { spec, opts } = co;
    s.pendingChain = spec.type === 'chain';
    s.chainOptions = spec.type === 'chain' ? opts : null;
    for (const o of opts) {
      if (spec.type === 'tile') b.tileClass(o, s.kind === 'card' && getCard(this.view.inst[s.iid].cardId).type === 'Identity' ? 'summon' : 'pick');
      else if (spec.type === 'lane') b.pickLane(o);
      else if (spec.type === 'unit' || spec.type === 'struct' || spec.type === 'unitOrStruct') b.entityClass(o, 'pick');
    }
    if (s.kind === 'ability' || s.kind === 'consume') b.entityClass(s.unit, 'selected');
  }
  rangeFrom(u, pos) {
    const rp = this.G.stat(u, 'rp');
    for (const t of this.board.around(pos, rp)) {
      if ((t.x !== pos.x || t.y !== pos.y) && !this.board.tileHas(t, 'move')) this.board.tileClass(t, 'range');
    }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  optsInclude(opts, v) { return opts.some((o) => (typeof o === 'object' ? o.x === v.x && o.y === v.y : o === v)); }
  onTile(pos) {
    if (!this.view) return;
    const s = this.sel;
    const co = this.currentOptions();
    if (co && this.canInteract()) {
      if (co.spec.type === 'tile' && this.optsInclude(co.opts, pos)) return this.addTarget({ x: pos.x, y: pos.y });
      if (co.spec.type === 'lane') { const l = this.G.laneAt(pos.x, pos.y); if (co.opts.includes(l)) return this.addTarget(l); }
      const occ = this.G.unitAt(pos.x, pos.y);
      if (occ && (co.spec.type === 'unit' || co.spec.type === 'unitOrStruct') && co.opts.includes(occ.iid)) return this.addTarget(occ.iid);
      sfx('error');
      return;
    }
    if (s && s.kind === 'unit' && this.canInteract()) {
      const u = this.G.unit(s.iid);
      if (u && u.owner === this.seat && this.reach && this.reach.has(pos.x + ',' + pos.y)) {
        this.act({ type: 'move', unit: u.iid, to: pos }, { keepUnit: u.iid });
        return;
      }
    }
    const occ = this.G.unitAt(pos.x, pos.y);
    if (occ) return this.onUnit(occ.iid);
    if (s) this.cancelSel(true);
  }
  onUnit(iid) {
    if (!this.view) return;
    const co = this.currentOptions();
    if (co && this.canInteract()) {
      if ((co.spec.type === 'unit' || co.spec.type === 'unitOrStruct') && co.opts.includes(iid)) return this.addTarget(iid);
      if (co.spec.type === 'tile') { const u = this.G.unit(iid); if (u && this.optsInclude(co.opts, u)) return this.addTarget({ x: u.x, y: u.y }); }
      if (co.spec.type === 'lane') { const u = this.G.unit(iid); if (u && co.opts.includes(this.G.laneOf(u))) return this.addTarget(this.G.laneOf(u)); }
      sfx('error');
      return;
    }
    const s = this.sel;
    if (s && s.kind === 'unit' && s.iid !== iid && this.canInteract()) {
      const a = this.G.unit(s.iid);
      if (a && a.owner === this.seat && this.G.attackTargets(a).includes(iid)) {
        this.act({ type: 'attack', unit: a.iid, target: iid }, { keepUnit: a.iid });
        return;
      }
    }
    if (s && s.kind === 'unit' && s.iid === iid) { this.cancelSel(); return; }
    this.selectUnit(iid);
  }
  onStruct(iid) {
    const co = this.currentOptions();
    if (co && this.canInteract()) {
      if ((co.spec.type === 'struct' || co.spec.type === 'unitOrStruct') && co.opts.includes(iid)) return this.addTarget(iid);
      if (co.spec.type === 'lane') { const st = this.view.structs[iid]; if (st && co.opts.includes(st.lane)) return this.addTarget(st.lane); }
      sfx('error');
      return;
    }
    const s = this.sel;
    if (s && s.kind === 'unit' && this.canInteract()) {
      const a = this.G.unit(s.iid);
      if (a && a.owner === this.seat && this.G.attackTargets(a).includes(iid)) { this.act({ type: 'attack', unit: a.iid, target: iid }, { keepUnit: a.iid }); return; }
    }
    this.sel = { kind: 'unit', iid };
    sfx('select');
    this.refreshHighlights();
    this.renderInspector();
  }
  onLane(l) {
    const co = this.currentOptions();
    if (co && this.canInteract() && co.spec.type === 'lane' && co.opts.includes(l)) return this.addTarget(l);
    if (co) sfx('error');
  }
  onHoverEntity(iid) {
    this.hovered = iid;
    const s = this.sel;
    if (s && s.kind === 'unit' && iid && this.canInteract()) {
      const a = this.G.unit(s.iid);
      if (a && a.owner === this.seat && this.G.attackTargets(a).includes(iid)) { this.showPreview(a.iid, iid); return; }
    }
    this.hidePreview();
    if (!this.sel) this.renderInspector(iid);
  }
  onTileHover(pos) {
    this.hoverTile = pos;
    const s = this.sel;
    this.board.clearPath();
    if (!pos || !s || s.kind !== 'unit' || !this.reach) { if (s && s.kind === 'unit') { const u = this.G.unit(s.iid); if (u && u.owner === this.seat) this.rangeFrom(u, u); } return; }
    const r = this.reach.get(pos.x + ',' + pos.y);
    const u = this.G.unit(s.iid);
    if (!u) return;
    if (!r) { if (u.owner === this.seat) this.rangeFrom(u, u); return; }
    for (const p of r.path) this.board.tileClass(p, 'path');
    this.rangeFrom(u, pos);
  }

  showPreview(attacker, target) {
    const G2 = new Game(JSON.parse(JSON.stringify(this.view)));
    G2.noUndo = true;
    const r = G2.act(this.seat, { type: 'attack', unit: attacker, target });
    let guard = 0;
    const evs = [...r.events];
    while (G2.s.chain.length && G2.s.priority !== null && guard++ < 4) evs.push(...G2.act(G2.s.priority, { type: 'pass' }).events);
    let dmg = 0, ret = 0, lethal = false, died = false;
    for (const e of evs) {
      if (e.t === 'damage' && e.target === target) dmg += e.amount;
      if (e.t === 'damage' && e.target === attacker) ret += e.amount;
      if ((e.t === 'defeat' || e.t === 'destroy') && e.target === target) lethal = true;
      if (e.t === 'defeat' && e.target === attacker) died = true;
    }
    const t = this.view.units[target] || this.view.structs[target];
    const left = Math.max(0, t.bp - dmg);
    const tip = this.previewEl || (this.previewEl = el('div.dmg-preview'));
    tip.className = 'dmg-preview' + (lethal ? ' lethal' : '');
    tip.innerHTML = `⚔️ <b>${dmg}</b> damage → ${lethal ? '<span class="lt">DEFEATED!</span>' : `${left} BP left`}` + (ret ? `<br>↩️ Counter-attack: <b>${ret}</b>${died ? ' <span style="color:#ff8d8d">(you fall!)</span>' : ''}` : '');
    document.body.appendChild(tip);
    const pos = this.board.screenOf(target);
    if (pos) { tip.style.left = pos.x + 30 + 'px'; tip.style.top = pos.y - 60 + 'px'; }
  }
  hidePreview() { if (this.previewEl) this.previewEl.remove(); }

  inspect(iid) {
    const u = this.view.units[iid] || this.view.structs[iid];
    if (!u) return;
    showCardModal(u.cardId, { variant: variantFor(iid) });
  }

  onKey(e) {
    if (document.querySelector('.modal-back') || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.cancelSel(); return; }
    if (k === ' ' || k === 'enter') {
      e.preventDefault();
      if (this.view.chain.length && this.view.priority === this.seat && !this.busy) this.act({ type: 'pass' });
      else if (this.sel && this.sel.specs && this.sel.targets.length >= this.sel.specs.length) this.commitSel();
      else if (this.myTurn() || this.mySetup()) this.endTurnClick();
      return;
    }
    if (k === 'tab') { e.preventDefault(); this.cycleUnits(e.shiftKey ? -1 : 1); return; }
    if (k === 'z' && this.view.canUndo) { this.act({ type: 'undo' }); return; }
    if (k === 'v') { this.board.overview(); return; }
    if (k === 'w' || k === 'arrowup') this.board.panScreen(0, 60);
    else if (k === 's' || k === 'arrowdown') this.board.panScreen(0, -60);
    else if (k === 'a' || k === 'arrowleft') this.board.panScreen(60, 0);
    else if (k === 'd' || k === 'arrowright') this.board.panScreen(-60, 0);
    else if (k === 'q') this.board.rotateBy(-15);
    else if (k === 'e') this.board.rotateBy(15);
    else if (k === 'r') this.board.tiltBy(6);
    else if (k === 'f') this.board.tiltBy(-6);
    else if (k === 'c' || k === 'home') this.board.resetCam();
    else if (k === '+' || k === '=') this.board.zoomBy(1.12);
    else if (k === '-' || k === '_') this.board.zoomBy(1 / 1.12);
    else if (k === 'l') this.logPanel.classList.toggle('collapsed');
    else if (k === 'h' || k === '?') this.help();
    else if (k === 'm') toggleMute(null);
    else if (/^[1-9]$/.test(k)) {
      const iid = this.view.players[this.seat].hand[+k - 1];
      if (iid) this.clickCard(iid, this.canInteract() && this.G.canPlay(this.seat, iid));
    }
  }
  cycleUnits(dir) {
    const mine = this.G.unitsOf(this.seat).filter((u) => u.state !== 'done' || u.freeSteps > 0);
    if (!mine.length) return;
    const cur = this.sel && this.sel.kind === 'unit' ? mine.findIndex((u) => u.iid === this.sel.iid) : -1;
    const next = mine[(cur + dir + mine.length) % mine.length];
    this.selectUnit(next.iid);
    this.board.focusTile(next);
  }

  async endTurnClick() {
    if (this.busy) return;
    if (this.mySetup()) { this.sel = null; this.act({ type: 'ready' }); return; }
    if (!this.myTurn()) return;
    if (this.sel && this.sel.kind === 'endPhase') { this.confirmEnd(); return; }
    if (this.settings.confirmEndTurn) {
      const idle = this.G.unitsOf(this.seat).filter((u) => u.state === 'ready' && (this.G.attackTargets(u).length || (this.G.moveBudget(u) > 0 && this.G.reachable(u).size)));
      const playable = this.G.playableCards(this.seat).length;
      if (idle.length || playable) {
        const ok = await confirmBox(`${idle.length ? `${idle.length} Identit${idle.length > 1 ? 'ies haven’t' : 'y hasn’t'} acted yet` : ''}${idle.length && playable ? ' and ' : ''}${playable ? `you have ${playable} playable card${playable > 1 ? 's' : ''}` : ''}. End your turn anyway?`, { yes: 'End Turn', title: 'End Turn?' });
        if (!ok) return;
      }
    }
    // End Phase: optionally pick cards to discard before passing the turn.
    if (this.view.players[this.seat].hand.length) {
      this.sel = { kind: 'endPhase', discard: new Set() };
      sfx('open');
      this.refreshHighlights();
      this.renderHand();
      this.renderHint();
      this.renderButtons();
      return;
    }
    this.confirmEnd();
  }
  confirmEnd() {
    const discard = this.sel && this.sel.kind === 'endPhase' ? [...this.sel.discard] : [];
    this.sel = null;
    this.act({ type: 'endTurn', discard });
  }

  async act(action, { keepUnit = null } = {}) {
    if (this.busy && action.type !== 'pass') return;
    this.hidePreview();
    if (action.type !== 'undo') this.sel = keepUnit ? { kind: 'unit', iid: keepUnit } : null;
    else this.sel = null;
    const ok = await this.onAct(action);
    if (ok === false) { this.refreshHighlights(); this.renderHint(); this.renderHand(); }
  }

  // -------------------------------------------------------------------------
  // Inspector
  // -------------------------------------------------------------------------
  renderInspector(hoverIid = null) {
    const ins = this.inspector;
    const iid = (this.sel && (this.sel.kind === 'unit' ? this.sel.iid : this.sel.unit)) || hoverIid;
    if (!iid || !this.view) { ins.classList.add('hidden'); return; }
    const u = this.view.units[iid];
    const st = this.view.structs[iid];
    if (!u && !st) { ins.classList.add('hidden'); return; }
    ins.classList.remove('hidden');
    clear(ins);
    const ent = u || st;
    const card = getCard(ent.cardId);
    const mine = ent.owner === this.seat;
    ins.appendChild(el('div.ins-head',
      el('div.avatar.small' + (mine ? '' : '.foe'), card.emoji),
      el('div', el('div.ins-name', card.name), el('div.ins-sub', `${mine ? 'Yours' : this.nameOf(ent.owner) + (this.isFoe(ent.owner) ? '' : ' (ally)')} · ${card.cls}${card.faction ? ' · ' + card.faction : ''}`))));
    if (u) {
      const S = this.G.statsOf(this.G.unit(iid));
      ins.appendChild(el('div.bars',
        el('span', 'BP'), barEl(u.bp, S.maxBp, '#3ddc75'), el('span', `${u.bp}/${S.maxBp}`),
        el('span', 'MP'), barEl(u.mp, S.maxMp, '#6ea2ff'), el('span', `${u.mp}/${S.maxMp}`)));
      const apNow = this.G.apAvail(this.G.unit(iid));
      ins.appendChild(statRow(card.stats, { bp: S.maxBp, sp: S.sp, mp: S.maxMp, ap: u.owner === this.seat ? apNow : this.G.stat(this.G.unit(iid), 'ap'), rp: S.rp }));
      const sts = el('div.statuses');
      if (u.barrier) sts.appendChild(el('span.good', `💠 Barrier ${u.barrier}`));
      if (u.freeSteps) sts.appendChild(el('span.good', `👣 ${u.freeSteps} free step${u.freeSteps > 1 ? 's' : ''}`));
      for (const s of u.statuses) sts.appendChild(el('span' + ((s.v || 0) < 0 || s.kind === 'stasis' || s.kind === 'marked' || s.kind === 'healReduce' ? '.bad' : '.good'), s.label || s.kind || `${s.v > 0 ? '+' : ''}${s.v} ${s.stat}`));
      if (u.owner === this.seat) sts.appendChild(el('span', u.state === 'ready' ? '● Ready' : u.state === 'active' ? '◐ Acting' : '○ Done'));
      const gu0 = this.G.unit(iid);
      sts.appendChild(el('span', { 'data-tip': 'Retaliation: when attacked, strikes back if the attacker is in range and it has the MP.' }, `↩ Retaliate ${this.G.retaliationCost(gu0)} MP`));
      if (this.G.isInvading(this.G.unit(iid))) sts.appendChild(el('span.bad', '⚔ Invading'));
      else if (this.G.isDefending(this.G.unit(iid))) sts.appendChild(el('span.good', '🛡 Defending'));
      ins.appendChild(sts);
      const u2 = card.unique;
      if (u2) ins.appendChild(el('div.abil', { html: u2.combo ? `<b>${esc(u2.name)}</b> — ${esc(u2.text)}` : u2.active ? `<b>${esc(u2.active.name)}</b> (${u2.active.cost} MP) ${esc(u2.text)}` : `<b>${esc(u2.name)}</b> — ${esc(u2.text)}` }));
      if (card.shared) ins.appendChild(el('div.abil', { html: `<b>${esc(card.shared.name)}</b> <span class="muted tiny">${esc(card.cls)}+${esc(card.archetype)}</span><br>${esc(card.shared.text)}` }));
      const slots = el('div.slots');
      if (u.eq) { const d = getCard(this.view.inst[u.eq].cardId); slots.appendChild(el('div', { onclick: () => showCardModal(d.id), 'data-tip': d.text }, `⚔️ ${d.emoji} ${d.name}`)); }
      if (u.cons) { const d = getCard(this.view.inst[u.cons].cardId); slots.appendChild(el('div', { onclick: () => showCardModal(d.id), 'data-tip': d.text }, `🧪 ${d.emoji} ${d.name}`)); }
      if (slots.children.length) ins.appendChild(slots);
      if (mine && this.canInteract() && !this.view.chain.length) {
        const acts = el('div.acts');
        const gu = this.G.unit(iid);
        for (const ab of this.G.unitAbilities(gu)) {
          const cost = this.G.abilityCost(gu, ab.ab);
          const ok = this.G.abilityUsable(gu, ab.key);
          acts.appendChild(el('button.btn.small' + (ok ? '.purple' : ''), { disabled: !ok, onclick: () => this.startAbility(iid, ab.key), 'data-tip': ok ? '' : 'Not enough MP, no target, or already used this activation.' }, el('span', '✨ ' + ab.name), el('span', `${cost} MP`)));
        }
        if (gu.cons && this.G.def(gu.cons).use) {
          const ok = this.G.consumableUsable(gu);
          acts.appendChild(el('button.btn.small' + (ok ? '.green' : ''), { disabled: !ok, onclick: () => this.startConsume(iid) }, el('span', '🧪 Use ' + this.G.def(gu.cons).name), el('span', '')));
        }
        if (this.G.canAttack(gu) && gu.state !== 'done') acts.appendChild(el('div.tiny.muted', `⚔️ Attack: ${this.G.attackCost(gu)} MP each — click a red-ringed target.`));
        if (gu.state !== 'done') acts.appendChild(el('button.btn.small.ghost', { onclick: () => this.act({ type: 'wait', unit: iid }) }, el('span', '⏸ Finish activation'), el('span', '')));
        ins.appendChild(acts);
      }
    } else {
      const max = this.G.structMaxBp(this.G.struct(iid));
      ins.appendChild(el('div.bars', el('span', 'BP'), barEl(st.bp, max, '#3ddc75'), el('span', `${st.bp}/${max}`)));
      ins.appendChild(el('div.statuses', el('span', `🏠 Housing ${this.G.housedCount(this.G.struct(iid))}/${this.G.structHousing(this.G.struct(iid))}`), el('span', this.G.laneName(st.lane))));
      ins.appendChild(el('div.abil', card.text));
    }
    ins.appendChild(el('div.tiny.muted', { style: { marginTop: '6px' } }, 'Right-click to inspect the full card.'));
  }

  // -------------------------------------------------------------------------
  // Event animation
  // -------------------------------------------------------------------------
  play(events, view) {
    this.queue = this.queue.then(() => this._play(events, view)).catch((e) => console.error(e));
    return this.queue;
  }
  async _play(events, view) {
    if (this.closed) return;
    this.busy = true;
    this.renderButtons();
    this.board.clearHighlights();
    try {
      for (const e of events) {
        if (this.closed) return;
        await this.anim(e, view);
      }
    } catch (err) { console.error(err); }
    this.busy = false;
    this.sync(view);
    if (view.phase === 'over' && !this.overShown) { this.overShown = true; await this.wait(500); this.onGameOver && this.onGameOver(view); }
  }
  screenPos(iid) { return this.board.screenOf(iid) || { x: innerWidth / 2, y: innerHeight / 2 }; }
  follow(pos) { if (this.settings.autoCamera && pos) this.board.gentleFollow(pos); }

  async anim(e, view) {
    const B = this.board;
    const me = this.seat;
    switch (e.t) {
      case 'turn': {
        const mine = e.p === me;
        const foe = this.isFoe(e.p);
        this.sel = null;
        B.clearHighlights();
        const title = mine ? 'YOUR TURN' : `${this.nameOf(e.p).toUpperCase()}'S TURN`;
        const tb = el('div.turn-banner', el('div.tb' + (mine || !foe ? '' : '.foe'), title, el('small', `ROUND ${e.round}`)));
        this.root.appendChild(tb);
        sfx(mine ? 'turn' : 'enemyTurn');
        if (this.settings.autoCamera && mine) B.resetCam();
        await this.wait(mine ? 1100 : 800);
        tb.remove();
        if (!mine && this.mode === 'ai' && this.rival && e.round === 1 && foe) this.say(e.p, this.rival.quote);
        break;
      }
      case 'recover': break;
      case 'step': break;
      case 'setupTurn': break;
      case 'ready': if (e.p !== me) { const b = this.boxes[e.p]; if (b) { const r = b.getBoundingClientRect(); floatText(r.right - 30, r.top + 20, 'Ready!', 'good'); } } break;
      case 'reshuffle': {
        const b = this.boxes[e.p];
        if (b) { const r = b.getBoundingClientRect(); floatText(r.left + r.width / 2, r.top, '🔄 Discard reshuffled', 'good'); }
        sfx('card');
        break;
      }
      case 'discard': if (e.p === me) sfx('card'); break;
      case 'unclaim': B.syncLane(e.lane, null, null); break;
      case 'eliminated': {
        const mine = e.p === me;
        const banner = el('div.elim-banner', mine ? '💀 YOU WERE ELIMINATED' : `💀 ${this.nameOf(e.p).toUpperCase()} ELIMINATED!`);
        document.body.appendChild(banner);
        sfx(mine ? 'lose' : 'fanfare');
        FX.shake(this.board.stage, 1.6);
        await this.wait(1600);
        setTimeout(() => banner.remove(), 900);
        break;
      }
      case 'draw':
        if (e.p === me && e.iid) this.newDraws.add(e.iid);
        if (e.p === me) { sfx('card'); await this.wait(90); }
        break;
      case 'burn': if (e.p === me && e.cardId) toast(`Hand full (7) — ${getCard(e.cardId).name} was discarded.`, 'bad'); break;
      case 'play': {
        const card = getCard(e.cardId);
        if (!card) break;
        const other = e.p !== me;
        if ((other && card.type !== 'Zone') || card.type === 'Action' || card.type === 'Event') {
          const col = colorsFor(view, me)[e.p][0];
          const pc = el('div.played-card', el('div.who', { style: { color: col } }, other ? `${this.nameOf(e.p)} plays` : 'You play'), cardEl(card, { width: 230 }));
          document.body.appendChild(pc);
          sfx('play');
          await this.wait(other ? (view.phase === 'setup' ? 500 : 900) : 700);
          setTimeout(() => pc.remove(), 600);
        } else sfx('play');
        break;
      }
      case 'zone': {
        B.syncLane(e.lane, e.cardId, e.p, view.lanes[e.lane]);
        if (e.p !== me && view.phase !== 'setup') this.follow(B.laneCenter(view.lanes[e.lane]));
        const pos = B.screenOfLane(e.lane);
        sfx('zone');
        FX.burst(pos.x, pos.y, { colors: ['#b8ffcf', '#fff', '#ffe28a'], count: 34, speed: 6, shape: 'leaf', size: 6, gravity: 0.05, life: 1.2 });
        if (e.capture) floatText(pos.x, pos.y - 40, '🚩 Lane Captured!', 'gold');
        await this.wait(550);
        break;
      }
      case 'struct': {
        if (e.p !== me) this.follow({ x: e.x, y: e.y });
        const node = B.addStruct(e.iid, e.cardId, e.p, e.x, e.y);
        B.updateStruct(node, { bp: e.bp, cardId: e.cardId }, null);
        node.classList.add('building');
        sfx('build');
        const pos = B.screenOf(e.iid);
        if (pos) FX.burst(pos.x, pos.y + 30, { colors: ['#c9a36b', '#8a6a3a', '#fff'], count: 30, speed: 5, gravity: 0.2, size: 5 });
        await this.wait(700);
        break;
      }
      case 'summon': {
        if (!B.units.has(e.unit)) B.addUnit(e.unit, e.cardId, e.p, e.x, e.y);
        const node = B.units.get(e.unit);
        node.classList.add('summoning');
        setTimeout(() => node.classList.remove('summoning'), 700);
        if (e.p !== me) this.follow({ x: e.x, y: e.y });
        await this.wait(30);
        const pos = B.screenOfTile({ x: e.x, y: e.y });
        FX.magicCircle(pos.x, pos.y, colorsFor(view, me)[e.p][0]);
        sfx('summon');
        await this.wait(e.token ? 350 : 600);
        break;
      }
      case 'attach': {
        const pos = this.screenPos(e.unit);
        floatText(pos.x, pos.y - 50, `${getCard(e.cardId).emoji} ${getCard(e.cardId).name}`, 'good');
        sfx('buff');
        await this.wait(350);
        break;
      }
      case 'detach': { const pos = this.screenPos(e.unit); floatText(pos.x, pos.y - 50, `Disarmed!`, 'bad'); await this.wait(250); break; }
      case 'move': {
        if (!B.units.has(e.unit)) break;
        const last = e.path[e.path.length - 1];
        if (e.unit && view.units[e.unit] && view.units[e.unit].owner !== me) this.follow(last);
        sfx(e.forced ? 'whoosh' : 'move');
        await B.animateMove(e.unit, e.path, (e.forced ? 90 : 120) / this.speed);
        break;
      }
      case 'teleport': sfx('whoosh'); await B.animateTeleport(e.unit, e.to, 380 / this.speed); break;
      case 'bump': { const pos = this.screenPos(e.unit); FX.hitSparks(pos.x, pos.y, '#dddddd'); B.flash(e.unit); await this.wait(120); break; }
      case 'declare': {
        const a = this.screenPos(e.unit);
        const t = this.screenPos(e.target);
        if (view.units[e.unit] && view.units[e.unit].owner !== me) this.follow(view.units[e.unit]);
        FX.ring(t.x, t.y, { color: '#ff5a6e', radius: 46, life: 0.4, width: 4 });
        void a;
        await this.wait(120);
        break;
      }
      case 'chain':
        if (e.priority === me) { sfx('open'); }
        break;
      case 'attack': {
        const a = this.screenPos(e.unit);
        const t = this.screenPos(e.target);
        if (e.ranged) {
          sfx('shoot');
          B.lunge(e.unit, e.target, 200 / this.speed);
          const ow = (view.units[e.unit] || this.view.units[e.unit] || {}).owner;
          await FX.projectile(a, t, { color: ow !== undefined ? colorsFor(view, me)[ow][0] : '#fff', life: 0.3 / this.speed });
        } else {
          sfx('swing');
          await B.lunge(e.unit, e.target, 260 / this.speed);
        }
        break;
      }
      case 'retaliate': {
        const pos = this.screenPos(e.unit);
        floatText(pos.x, pos.y - 56, '↩ Counter!', 'bad');
        const t = this.screenPos(e.target);
        if (this.view && cheb(this.view.units[e.unit] || { x: 0, y: 0 }, this.view.units[e.target] || { x: 99, y: 99 }) > 1) await FX.projectile(pos, t, { color: '#ffd76a', life: 0.25 / this.speed });
        else await B.lunge(e.unit, e.target, 220 / this.speed);
        break;
      }
      case 'damage': {
        const pos = this.screenPos(e.target);
        const big = e.amount >= 4 || e.struct;
        if (e.amount > 0) {
          B.flash(e.target);
          FX.hitSparks(pos.x, pos.y, e.kind === 'collision' ? '#dddddd' : '#ffe28a', big);
          floatText(pos.x + (Math.random() * 20 - 10), pos.y - 20, String(e.amount), 'num' + (big ? ' big' : ''));
          sfx(big ? 'crit' : 'hit');
          if (big) FX.shake(this.board.stage, e.struct ? 1.2 : 0.8);
        } else {
          floatText(pos.x, pos.y - 20, e.blocked ? `Blocked ${e.blocked}` : '0', 'num block');
          sfx('block');
        }
        if (e.blocked && e.amount > 0) floatText(pos.x + 26, pos.y + 6, `🛡${e.blocked}`, 'num block');
        B.setHpFromEvent(e.target, e.bp);
        await this.wait(big ? 300 : 220);
        break;
      }
      case 'heal': {
        const pos = this.screenPos(e.target);
        FX.healSparkles(pos.x, pos.y);
        floatText(pos.x, pos.y - 24, '+' + e.amount, 'num heal');
        B.setHpFromEvent(e.target, e.bp);
        sfx('heal');
        await this.wait(200);
        break;
      }
      case 'mp': {
        const pos = this.screenPos(e.target);
        if (e.amount > 0) { floatText(pos.x + 18, pos.y - 6, `+${e.amount} MP`, 'num mp'); sfx('mana'); }
        else floatText(pos.x + 18, pos.y - 6, `${e.amount} MP`, 'num mp');
        B.setMpFromEvent(e.target, e.mp);
        await this.wait(90);
        break;
      }
      case 'status': {
        const pos = this.screenPos(e.target);
        floatText(pos.x, pos.y - 64, e.text, e.good ? 'good' : 'bad');
        sfx(e.good ? 'buff' : 'debuff');
        await this.wait(200);
        break;
      }
      case 'freeStep': { const pos = this.screenPos(e.unit); floatText(pos.x, pos.y - 64, `👣 +${e.n} step${e.why ? ' · ' + e.why : ''}`, 'good'); await this.wait(150); break; }
      case 'ability': {
        const pos = this.screenPos(e.unit);
        floatText(pos.x, pos.y - 70, `✨ ${e.name}`, 'gold');
        FX.ring(pos.x, pos.y + 30, { color: '#d59cff', radius: 60, squash: 0.45, life: 0.6 });
        FX.burst(pos.x, pos.y, { colors: ['#d59cff', '#fff'], count: 16, speed: 3, shape: 'star', gravity: -0.05 });
        sfx('ability');
        if (view.units[e.unit] && view.units[e.unit].owner !== me) this.follow(view.units[e.unit]);
        await this.wait(420);
        break;
      }
      case 'consume': { const pos = this.screenPos(e.unit); floatText(pos.x, pos.y - 70, `🧪 ${e.name}`, 'good'); sfx('mana'); await this.wait(350); break; }
      case 'defeat': {
        if (e.quiet) { B.killUnit(e.target, 250); break; }
        const pos = this.screenPos(e.target);
        floatText(pos.x, pos.y - 30, 'K.O.!', 'num ko');
        FX.explode(pos.x, pos.y, e.owner === me ? ['#8fd0ff', '#ffffff', '#6ea2ff'] : ['#ff9f43', '#ffd76a', '#ff5252', '#ffffff']);
        sfx('defeat');
        await B.killUnit(e.target);
        break;
      }
      case 'bounce': { const pos = this.screenPos(e.target); FX.burst(pos.x, pos.y, { colors: ['#fff', '#9ad0ff'], count: 20, shape: 'star' }); sfx('whoosh'); await B.killUnit(e.target); break; }
      case 'destroy': {
        const pos = this.screenPos(e.target);
        FX.explode(pos.x, pos.y);
        FX.burst(pos.x, pos.y + 20, { colors: ['#8a6a3a', '#5a4020', '#c9a36b'], count: 40, speed: 7, gravity: 0.3, size: 6, shape: 'rect' });
        FX.shake(this.board.stage, 1.8);
        sfx('crumble');
        floatText(pos.x, pos.y - 70, e.owner === me ? '💥 Your Structure fell!' : '💥 Structure destroyed!', e.owner === me ? 'bad' : 'gold');
        if (!e.quiet && this.mode === 'ai' && this.rival && this.view.players.length === 2) this.say(1 - me, e.owner === me ? pick(['Down it goes!', 'Your walls crumble!', 'Hah! Timber!']) : pick(['Hey! That was mine!', 'Grr… lucky shot.', 'My poor Structure!']));
        if (e.quiet) { B.crumble(e.target, 300); break; }
        await B.crumble(e.target);
        break;
      }
      case 'obstacle': B.addObstacle(e.x, e.y); sfx('build'); await this.wait(250); break;
      case 'fizzle': { floatText(innerWidth / 2, innerHeight * 0.35, e.text, 'bad'); sfx('cancel'); await this.wait(500); break; }
      case 'resolve': await this.wait(120); break;
      case 'win': break;
      case 'undo': sfx('cancel'); break;
      default: break;
    }
  }
  patchPlayer(p, patch) {
    if (!this.view) return;
    Object.assign(this.view.players[p], patch);
    this.renderPlayers();
  }
  say(p, text) {
    const box = this.boxes[p] || this.meBox;
    const r = box.getBoundingClientRect();
    const b = el('div.speech-bubble', text);
    b.style.left = r.right + 12 + 'px';
    b.style.top = r.top + 6 + 'px';
    this.root.appendChild(b);
    setTimeout(() => b.remove(), 4200);
  }
  setThinking(on, p = null) {
    this.thinking.classList.toggle('hidden', !on);
    if (on && p !== null && this.boxes[p]) this.boxes[p].after(this.thinking);
  }
  setDeadline(deadline, serverNow, kind) {
    this.deadline = deadline ? deadline - serverNow + Date.now() : null;
    this.deadlineKind = kind;
    if (!this.timerInt) this.timerInt = setInterval(() => this.renderTimer(), 250);
    this.renderTimer();
  }
  renderTimer() {
    const v = this.view;
    if (!this.deadline || !v || v.phase === 'over') { this.timerEl.textContent = ''; return; }
    const secs = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    const k = this.deadlineKind;
    const who = k === 'setup' ? (v.active === this.seat ? 'Setup' : `${this.nameOf(v.active)} setting up`) : k === 'response' ? (v.priority === this.seat ? 'Respond' : `${this.nameOf(v.priority)} responding`) : v.active === this.seat ? 'Your turn' : `${this.nameOf(v.active)}'s turn`;
    this.timerEl.textContent = `⏱ ${who}: ${secs}s`;
    this.timerEl.classList.toggle('low', secs <= 10 && (k !== 'turn' || v.active === this.seat));
  }

  // -------------------------------------------------------------------------
  // Misc UI
  // -------------------------------------------------------------------------
  showDiscard(p) {
    const P = this.view.players[p];
    const grid = el('div.card-grid', { style: { '--cw': '130px', maxWidth: '760px' } });
    for (const iid of [...P.discard].reverse()) {
      const id = this.view.inst[iid] && this.view.inst[iid].cardId;
      if (!id) continue;
      const c = cardEl(id, { width: 130, variant: variantFor(iid) });
      c.addEventListener('click', () => showCardModal(id));
      grid.appendChild(c);
    }
    if (!grid.children.length) grid.appendChild(el('p.muted', 'Empty.'));
    modal({ title: (p === this.seat ? 'Your' : `${this.nameOf(p)}'s`) + ' Discard Pile', body: grid });
  }
  async menu() {
    const r = await modal({
      title: 'Menu',
      body: el('div.col', { style: { minWidth: '260px' } }, el('p.muted', this.mode === 'online' ? 'Leaving counts as a concession.' : 'Take a breather.')),
      actions: [{ label: 'Resume', value: null, cls: 'gold' }, { label: '❓ Rules', value: 'rules', cls: 'ghost' }, { label: '🏳 Concede', value: 'concede', cls: 'red' }],
    });
    if (r === 'rules') this.help();
    if (r === 'concede' && await confirmBox('Concede this match?', { yes: 'Concede', danger: true })) this.act({ type: 'concede' });
  }
  async help() {
    const { rulesBody } = await import('../screens/rules.js');
    modal({ title: 'How to Play', body: rulesBody(true), width: 'min(900px, 94vw)' });
  }
}

function barEl(v, max, color) {
  return el('div.hpbar', el('i.ghost', { style: { width: (v / Math.max(1, max)) * 100 + '%' } }), el('i', { style: { width: (v / Math.max(1, max)) * 100 + '%', background: color } }));
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function variantFor(iid) {
  let h = 0;
  for (let i = 0; i < iid.length; i++) h = (h * 31 + iid.charCodeAt(i)) >>> 0;
  return h % 81;
}

// ===========================================================================
// Match flows
// ===========================================================================
// me: { name, avatar, deck }; foe: the main opponent { name, avatar, deck } (ladder rival or bot);
// extra: more bots for 3-4 player formats, in seat order after the foe
// (for 2v2 the first extra bot is your teammate).
export async function startLocalBattle({ me, foe, difficulty, rival = null, onFinish, format = '1v1', extra = [] }) {
  playMusic(difficulty >= 8 ? 'boss' : 'battle');
  const players = [{ ...me, bot: false }, { ...foe, bot: true, difficulty }, ...extra.map((b) => ({ ...b, bot: true, difficulty: b.difficulty || difficulty }))];
  const match = new LocalMatch({ players, format });
  let running = false;
  let aiFailures = 0;
  const plansPerTurn = new Map();
  const infos = players.map((p) => ({ name: p.name, avatar: p.avatar }));
  const ui = new BattleView({
    seat: 0, side: match.state.players[0].side, mode: 'ai', infos, rival, difficulty,
    onAct: async (action) => {
      const r = match.apply(0, action);
      if (!r.ok) { sfx('error'); toast(r.error, 'bad', 1.8); return false; }
      if (action.type === 'setAutoRetaliate') return true;
      await ui.play(r.events, match.view());
      runAI();
      return true;
    },
  });
  match.apply(0, { type: 'setAutoRetaliate', on: getProfile().settings.autoRetaliate });
  ui.onGameOver = (view) => showResults({ ui, view, mode: 'ai', difficulty, rival, onFinish, rematch: () => startLocalBattle({ me, foe, difficulty, rival, onFinish, format, extra }) });
  window.__knotwood = { match, ui }; // handy for debugging from the console
  ui.sync(match.view());
  await vsSplash(infos, rival, format);
  async function runAI() {
    if (running || ui.closed) return;
    running = true;
    try {
      let guard = 0;
      while (match.needsAI() && !ui.closed && guard++ < 600) {
        const s = match.state;
        const p = match.actingBot();
        const key = s.turnSerial + ':' + p;
        plansPerTurn.set(key, (plansPerTurn.get(key) || 0) + 1);
        const busyTurn = s.phase === 'play' && !s.chain.length;
        if (busyTurn) ui.setThinking(true, p);
        const t0 = performance.now();
        let plan = await match.think(p);
        const minWait = (busyTurn ? 320 : 120) / ui.speed;
        const spent = performance.now() - t0;
        if (spent < minWait) await sleep(minWait - spent);
        ui.setThinking(false);
        if (ui.closed) break;
        const fallback = s.phase === 'setup' ? { type: 'ready' } : s.chain.length ? { type: 'pass' } : { type: 'endTurn' };
        if (!plan || !plan.length || plansPerTurn.get(key) > 60 || aiFailures > 4) { plan = [fallback]; aiFailures = 0; }
        for (const a of plan) {
          if (match.actingBot() !== p || ui.closed) break;
          // a response window opened mid-plan: think again rather than push on
          if (match.state.chain.length && !['pass', 'play', 'consume'].includes(a.type)) break;
          const r = match.apply(p, a);
          if (!r.ok) {
            aiFailures++;
            console.warn('AI action rejected:', r.error, a);
            if (aiFailures > 4) { const r2 = match.apply(p, fallback); if (r2.ok) await ui.play(r2.events, match.view()); aiFailures = 0; }
            break;
          }
          aiFailures = 0;
          await ui.play(r.events, match.view());
          if (match.state.phase === 'over') break;
        }
      }
    } finally {
      running = false;
      ui.setThinking(false);
    }
  }
  await runAI();
  ui.sync(match.view());
  return ui;
}

export async function vsSplash(infos, rival, format = '1v1') {
  const fmt = FORMATS[format] || FORMATS['1v1'];
  const side = (i, cls) => el('div.vs-side' + cls, el('div.avatar' + (cls === '.foe' ? '.foe' : ''), infos[i].avatar || '🙂'), el('div.vs-name', infos[i].name));
  let node;
  if (infos.length === 2) {
    node = el('div.vs-screen',
      el('div.vs-side.me', el('div.avatar', infos[0].avatar), el('div.vs-name', infos[0].name), el('div.vs-quote', '“Let’s do this!”')),
      el('div.vs-mid', 'VS'),
      el('div.vs-side.foe', el('div.avatar.foe', infos[1].avatar), el('div.vs-name', infos[1].name), rival ? el('div', { style: { opacity: 0.85 } }, rival.title) : null, el('div.vs-quote', '“' + (rival ? rival.quote : 'Good luck, have fun!') + '”')));
  } else {
    const teams = {};
    fmt.teams.forEach((t, i) => { (teams[t] = teams[t] || []).push(i); });
    const groups = Object.values(teams).map((seats) => el('div.vs-team', ...seats.map((i) => side(i, i === 0 ? '.me' : fmt.teams[i] === fmt.teams[0] ? '.me' : '.foe'))));
    const parts = [];
    groups.forEach((g, k) => { if (k) parts.push(el('div.vs-mid', 'VS')); parts.push(g); });
    node = el('div.vs-screen.multi', el('div.vs-format', fmt.name), el('div.vs-row', ...parts));
  }
  document.body.appendChild(node);
  sfx('whoosh');
  setTimeout(() => sfx('crit'), 400);
  await sleep(2100);
  node.style.transition = 'opacity .4s';
  node.style.opacity = '0';
  await sleep(400);
  node.remove();
}

// ---------------------------------------------------------------------------
export function computeRewards({ view, mode, difficulty, rival, seat }) {
  const win = view.winners.includes(seat);
  const st = view.stats[seat];
  const lines = [];
  let total = 0;
  const add = (label, n) => { if (!n) return; lines.push([label, n]); total += n; };
  const bigger = view.players.length > 2 ? 1.25 : 1;
  if (mode === 'ai') {
    const base = rival ? (win ? rival.reward : Math.round(rival.reward * 0.3)) : win ? 40 + difficulty * 15 : 15 + difficulty * 3;
    add(win ? 'Victory' : 'Participation', Math.round(base * bigger));
  } else add(win ? 'Online Victory' : 'Online Match', win ? 150 : 50);
  add(`Structures destroyed ×${st.structures}`, Math.min(30, st.structures * 5));
  add(`Lanes captured ×${st.captures}`, Math.min(24, st.captures * 6));
  add(`Foes defeated ×${st.kills}`, Math.min(20, st.kills * 2));
  add(`Players eliminated ×${st.eliminations}`, Math.min(30, st.eliminations * 10));
  const lost = view.players.reduce((n, P, q) => n + (P.team !== view.players[seat].team ? view.stats[q].structures : 0), 0);
  if (win && lost === 0) add('Flawless Defense', 20);
  const p = getProfile();
  if (win && firstWinToday()) add('First win of the day', 100);
  if (win && mode === 'ai' && rival && !p.ladder.beaten.includes(rival.id)) add('Rival defeated for the first time!', 100);
  if (!win && mode === 'online' && view.round < 3 && view.players[seat].eliminated && view.winReason === 'Elimination' && st.damage === 0) { total = 0; lines.length = 0; lines.push(['Conceded early', 0]); }
  return { win, lines, total };
}

export async function showResults({ ui, view, mode, difficulty = 0, rival = null, onFinish, rematch = null }) {
  const seat = ui.seat;
  const res = computeRewards({ view, mode, difficulty, rival, seat });
  const p = getProfile();
  addPoints(res.total);
  recordResult({ win: res.win, online: mode === 'online' });
  let bonusPack = false;
  if (res.win && mode === 'ai' && rival && !p.ladder.beaten.includes(rival.id)) {
    p.ladder.beaten.push(rival.id);
    p.packs += 1;
    bonusPack = true;
    saveProfile();
  }
  playMusic(res.win ? 'victory' : 'menu');
  sfx(res.win ? 'fanfare' : 'lose');
  if (res.win) FX.confetti();
  const lines = el('div.reward-lines');
  res.lines.forEach(([l, n], i) => lines.appendChild(el('div', { style: { animationDelay: 0.4 + i * 0.15 + 's' } }, el('span', l), el('span.acorns', '+' + n))));
  lines.appendChild(el('div.total', { style: { animationDelay: 0.4 + res.lines.length * 0.15 + 's' } }, el('span', 'Total'), el('span.acorns', '+' + res.total)));
  if (bonusPack) lines.appendChild(el('div', el('span', '🎁 Bonus Booster Pack!'), el('span', '+1')));
  const quote = rival ? (res.win ? pick(['Hmph… you’re better than I thought.', 'Wow, you really beat me!', 'I’ll get you next time!']) : pick(['Ha! Better luck next time!', 'The forest favors me today.', 'Come back when you’ve trained more!'])) : null;
  const panel = el('div.win.gold', { style: { minWidth: 'min(460px, 92vw)', textAlign: 'center' } },
    el('div.win-title', 'RESULTS'),
    el('p', { style: { margin: '0 0 6px' } }, `${view.winners.map((q) => view.players[q]?.name || '?').join(' & ') || '?'} win${view.winners.length > 1 ? '' : 's'} by ${view.winReason}. · Round ${view.round}`),
    rival ? el('p.muted', `${rival.avatar} ${rival.name}: “${quote}”`) : null,
    lines,
    el('div.row', { style: { justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' } },
      rematch ? el('button.btn.green', { onclick: () => { node.remove(); rematch(); } }, '🔁 Rematch') : null,
      el('button.btn.gold', { onclick: () => { node.remove(); onFinish && onFinish(res); } }, 'Continue')));
  const node = el('div.results', el('div.col', { style: { alignItems: 'center', gap: '16px' } }, el('div.banner' + (res.win ? '.victory' : '.defeat'), res.win ? 'VICTORY!' : 'DEFEAT'), panel));
  document.body.appendChild(node);
  const cleanup = ui.root.cleanup;
  ui.root.cleanup = () => { node.remove(); cleanup && cleanup(); };
}

export { viewFor, topButtons };
