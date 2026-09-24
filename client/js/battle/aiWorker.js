// Runs the AI planner off the main thread so animations stay smooth.
import { aiPlan } from '../../../shared/ai.js';

self.onmessage = (e) => {
  const { id, state, p, difficulty, seed } = e.data;
  let plan;
  try { plan = aiPlan(state, p, difficulty, seed); } catch (err) { plan = null; self.postMessage({ id, error: String(err && err.stack || err) }); return; }
  self.postMessage({ id, plan });
};
