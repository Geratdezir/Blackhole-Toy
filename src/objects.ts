import * as T from 'three';
import type { State } from './physics';
import { CONFIG as C } from './config';
export const TYPES = {
  planet: { label: 'Planet', color: 0x69dcca, radius: 0.55 },
  moon: { label: 'Moon', color: 0xcbd4ef, radius: 0.38 },
  asteroid: { label: 'Asteroid', color: 0xdb9471, radius: 0.32 },
  star: { label: 'Star', color: 0xffd778, radius: 0.47 },
};
export type Kind = keyof typeof TYPES;
export interface Toy { state: State; mesh: T.Mesh; lensEcho: T.Mesh; kind: Kind; held: boolean; waiting: boolean; capture: number; trail: T.Line; history: T.Vector3[]; trailClock: number }
export function createToy(kind: Kind, x: number, z: number): Toy {
  const spec = TYPES[kind];
  const geometry = kind === 'asteroid' ? new T.IcosahedronGeometry(spec.radius, 0) : kind === 'star' ? new T.OctahedronGeometry(spec.radius, 0) : new T.SphereGeometry(spec.radius, 24, 16);
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color: spec.color, roughness: 0.6, emissive: spec.color, emissiveIntensity: kind === 'star' ? 1.2 : 0.13, transparent: true }));
  const lensEcho = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  lensEcho.visible = false; lensEcho.renderOrder = 3;
  mesh.position.set(x, 0, z);
  if (kind === 'planet') {
    const ring = new T.Mesh(new T.TorusGeometry(0.78, 0.055, 8, 40), new T.MeshStandardMaterial({ color: 0xa5fff0, transparent: true }));
    ring.rotation.x = Math.PI / 2.6; mesh.add(ring);
  }
  const trailGeometry = new T.BufferGeometry();
  trailGeometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(C.trailLength * 3), 3));
  trailGeometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(C.trailLength * 3), 3));
  trailGeometry.setDrawRange(0, 0);
  const trail = new T.Line(trailGeometry, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false }));
  trail.frustumCulled = false;
  return { state: { x, z, vx: 0, vz: 0 }, mesh, lensEcho, kind, held: false, waiting: true, capture: -1, trail, history: [], trailClock: 0 };
}
export function disposeToy(toy: Toy) {
  toy.mesh.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
  toy.mesh.removeFromParent(); toy.lensEcho.removeFromParent(); (toy.lensEcho.material as T.Material).dispose(); toy.trail.removeFromParent(); toy.trail.geometry.dispose(); (toy.trail.material as T.Material).dispose();
}
