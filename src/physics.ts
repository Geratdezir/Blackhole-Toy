import { CONFIG as C } from './config';
export interface State { x: number; z: number; vx: number; vz: number }
export function step(s: State, dt: number, pull: number) {
  const r = Math.hypot(s.x, s.z);
  const a = Math.min(C.maxAcceleration, C.gravity * pull / (r * r + C.softening ** 2));
  // Fixed-step semi-implicit Euler; softened, capped gravity stays finite at the center.
  const damping = Math.exp(-C.drag * dt);
  s.vx = (s.vx - s.x / Math.max(r, 0.001) * a * dt) * damping;
  s.vz = (s.vz - s.z / Math.max(r, 0.001) * a * dt) * damping;
  s.x += s.vx * dt; s.z += s.vz * dt;
}
export function predict(initial: State, pull: number): State[] {
  // Copy state, then use exactly the live integrator, timestep, and stopping rules.
  const s = { ...initial }; const points: State[] = [{ ...s }];
  for (let i = 0; i < C.predictionSteps; i++) {
    step(s, C.step, pull);
    if (i % 6 === 0) points.push({ ...s });
    const r = Math.hypot(s.x, s.z);
    if (r < C.horizon || r > C.escapeRadius) break;
  }
  return points;
}
