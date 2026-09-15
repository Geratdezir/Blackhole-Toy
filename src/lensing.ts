import * as T from 'three';
import { CONFIG as C } from './config';
import type { Toy } from './objects';

export interface LensingStrength { cheap: number; medium: number; strongest: number }

const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Pure zone calculation, kept separate so world/screen gating is testable. */
export function lensingStrength(worldDistance: number, screenDiskDistance: number): LensingStrength {
  const zones = C.visuals.lensing;
  if (worldDistance >= zones.outer) return { cheap: 0, medium: 0, strongest: 0 };
  const screenGate = 1 - smoothstep(0.78, 1.16, screenDiskDistance);
  const outerActivation = 1 - smoothstep(zones.inner, zones.outer, worldDistance);
  const innerActivation = 1 - smoothstep(zones.strongest, zones.inner, worldDistance);
  const strongest = 1 - smoothstep(C.horizon, zones.strongest, worldDistance);
  return {
    cheap: screenGate * outerActivation * (1 - innerActivation * 0.72),
    medium: screenGate * innerActivation,
    strongest: screenGate * strongest,
  };
}

const center = new T.Vector3();
const projected = new T.Vector3();
const edge = new T.Vector3();

/** Applies a positional bend plus one faint, local echo; no render target. */
export function updateObjectLensing(toys: Toy[], camera: T.Camera) {
  center.set(0, 0, 0).project(camera);
  let projectedDiskRadius = 0;
  for (const [x, z] of [[C.visuals.lensing.outer, 0], [-C.visuals.lensing.outer, 0], [0, C.visuals.lensing.outer], [0, -C.visuals.lensing.outer]]) {
    edge.set(x, 0, z).project(camera);
    projectedDiskRadius = Math.max(projectedDiskRadius, Math.hypot(edge.x - center.x, edge.y - center.y));
  }
  projectedDiskRadius = Math.max(projectedDiskRadius, 0.001);

  for (const toy of toys) {
    const { x, z } = toy.state;
    const worldDistance = Math.hypot(x, z);
    projected.set(x, 0, z).project(camera);
    const screenDistance = Math.hypot(projected.x - center.x, projected.y - center.y) / projectedDiskRadius;
    const strength = lensingStrength(worldDistance, screenDistance);
    const invRadius = 1 / Math.max(worldDistance, 0.001);
    const tangentX = -z * invRadius, tangentZ = x * invRadius;
    const primaryBend = strength.cheap * 0.11 + strength.medium * 0.24 + strength.strongest * 0.13;
    toy.mesh.position.set(x + tangentX * primaryBend, 0, z + tangentZ * primaryBend);

    const captureFade = toy.capture < 0 ? 1 : Math.max(0, 1 - toy.capture / C.captureDuration);
    const echoOpacity = (strength.medium * 0.14 + strength.strongest * 0.1) * captureFade;
    toy.lensEcho.visible = echoOpacity > 0.004;
    if (toy.lensEcho.visible) {
      const echoOffset = 0.13 + strength.strongest * 0.12;
      toy.lensEcho.position.set(x - tangentX * echoOffset, 0.015, z - tangentZ * echoOffset);
      toy.lensEcho.quaternion.copy(toy.mesh.quaternion);
      toy.lensEcho.scale.copy(toy.mesh.scale).multiplyScalar(1.03 + strength.medium * 0.05);
      (toy.lensEcho.material as T.MeshBasicMaterial).opacity = echoOpacity;
    }
  }
}
