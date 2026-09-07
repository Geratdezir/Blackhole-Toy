import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, predict } from '../src/physics';
import { CONFIG as C } from '../src/config';
test('prediction matches live fixed steps without mutating the object', () => {
  const s = { x: 9, z: 0, vx: 0, vz: 3.3 }; const original = { ...s }; const path = predict(s, 1);
  assert.deepEqual(s, original);
  step(s, C.step, 1); assert.deepEqual(path[1], s);
  for (let i = 0; i < 6; i++) step(s, C.step, 1);
  assert.deepEqual(path[2], s);
});
test('gravity remains finite at and near the origin', () => {
  for (const x of [0, 1e-12, 0.1]) { const s = { x, z: 0, vx: 0, vz: 0 }; for (let i = 0; i < 1000; i++) step(s, C.step, 2.5); assert.ok(Object.values(s).every(Number.isFinite)); }
});
test('a tangential throw curves, a fast throw escapes, and a dropped object is captured', () => {
  const orbit = { x: 9, z: 0, vx: 0, vz: 3.33 }; for (let i = 0; i < 1200; i++) step(orbit, C.step, 1); assert.ok(Math.hypot(orbit.x, orbit.z) > C.horizon); assert.ok(orbit.x < 0);
  const escape = { x: 9, z: 0, vx: 12, vz: 0 }; for (let i = 0; i < 1200; i++) step(escape, C.step, 1); assert.ok(Math.hypot(escape.x, escape.z) > C.escapeRadius);
  const drop = predict({ x: 4, z: 0, vx: 0, vz: 0 }, 1); assert.ok(drop.length < C.predictionSteps / 6);
});
