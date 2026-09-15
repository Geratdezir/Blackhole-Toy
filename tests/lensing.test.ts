import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lensingStrength } from '../src/lensing';

test('lensing is absent outside the disk and when detached on screen', () => {
  assert.deepEqual(lensingStrength(4.8, 0), { cheap: 0, medium: 0, strongest: 0 });
  assert.deepEqual(lensingStrength(2, 1.2), { cheap: 0, medium: 0, strongest: 0 });
});

test('lensing progresses from cheap to medium and strongest zones', () => {
  const outer = lensingStrength(3.6, 0.5);
  const inner = lensingStrength(2.2, 0.5);
  const nearHorizon = lensingStrength(1.4, 0.5);
  assert.ok(outer.cheap > 0 && outer.medium === 0);
  assert.ok(inner.medium > inner.cheap);
  assert.ok(nearHorizon.strongest > 0.8 && nearHorizon.medium > 0.8);
});
