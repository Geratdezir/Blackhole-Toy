import * as T from 'three';
import { CONFIG as C } from './config';
import { TYPES, type Toy } from './objects';

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function updateToy(toy: Toy, dt: number) {
  const { state: s, mesh } = toy; const r = Math.hypot(s.x, s.z);
  mesh.position.set(s.x, 0, s.z);
  // Radial stretch is visual only, and reverses when a flyby moves away.
  // Optical bending is handled by the shared screen-space lens. Physical
  // spaghettification only takes over in the tighter, innermost zone.
  const stretch = 1 + Math.max(0, 1 - (r - C.horizon) / 1.85) * 1.9;
  const captureT = toy.capture < 0 ? 0 : Math.min(1, toy.capture / C.captureDuration);
  const captureFade = toy.capture < 0 ? 0 : smoothstep(0.35, 1.0, captureT);
  const opacity = 1 - captureFade;
  mesh.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(s.x / Math.max(r, 0.001), 0, s.z / Math.max(r, 0.001)).normalize());
  mesh.scale.set(stretch, 1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch));
  mesh.traverse(o => { if (o instanceof T.Mesh) (o.material as T.MeshStandardMaterial).opacity = opacity; });
  toy.trailClock += dt;
  if (toy.trailClock >= C.trailInterval && !toy.held && !toy.waiting) {
    toy.trailClock = 0; toy.history.push(mesh.position.clone()); if (toy.history.length > C.trailLength) toy.history.shift();
    const positions = toy.trail.geometry.getAttribute('position');
    const colors = toy.trail.geometry.getAttribute('color'); const color = new T.Color(TYPES[toy.kind].color);
    toy.history.forEach((p, i) => { const fade = i / toy.history.length; positions.setXYZ(i, p.x, p.y, p.z); colors.setXYZ(i, color.r * fade, color.g * fade, color.b * fade); });
    positions.needsUpdate = colors.needsUpdate = true; toy.trail.geometry.setDrawRange(0, toy.history.length);
  }
}
