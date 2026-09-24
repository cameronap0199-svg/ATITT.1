// WebSocket client with automatic reconnection and match resume.
import { getProfile } from './profile.js';

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.queue = [];
    this.closedByUser = false;
    this.retries = 0;
  }
  url() {
    const custom = getProfile().settings.server;
    if (custom) return custom;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }
  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      try { this.ws = new WebSocket(this.url()); } catch (e) { reject(e); return; }
      const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Connection timed out')); try { this.ws.close(); } catch { /* ignore */ } } }, 6000);
      this.ws.onopen = () => {
        clearTimeout(timer);
        settled = true;
        this.retries = 0;
        for (const m of this.queue) this.ws.send(JSON.stringify(m));
        this.queue = [];
        this.emit('open', {});
        resolve();
      };
      this.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.emit(m.t, m); };
      this.ws.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('Could not reach the Knotwood server')); } };
      this.ws.onclose = () => {
        this.emit('close', {});
        if (!this.closedByUser && settled && this.retries < 6) {
          this.retries++;
          setTimeout(() => this.connect().then(() => this.emit('reconnected', {})).catch(() => {}), 800 * this.retries);
        }
      };
    });
  }
  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }
  on(t, f) { if (!this.handlers.has(t)) this.handlers.set(t, new Set()); this.handlers.get(t).add(f); return () => this.handlers.get(t).delete(f); }
  emit(t, m) { const hs = this.handlers.get(t); if (hs) for (const f of [...hs]) try { f(m); } catch (err) { console.error(err); } }
  close() { this.closedByUser = true; try { this.ws && this.ws.close(); } catch { /* ignore */ } }
}
