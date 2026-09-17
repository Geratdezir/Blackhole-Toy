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
export interface Toy { state: State; mesh: T.Mesh; lensEcho: T.Object3D; kind: Kind; held: boolean; waiting: boolean; capture: number; trail: T.Line; history: T.Vector3[]; trailClock: number }
export function createToy(kind: Kind, x: number, z: number): Toy {
  const spec = TYPES[kind];
  const geometry = kind === 'asteroid' ? new T.IcosahedronGeometry(spec.radius, 0) : kind === 'star' ? new T.OctahedronGeometry(spec.radius, 0) : new T.SphereGeometry(spec.radius, 24, 16);
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color: spec.color, roughness: 0.6, emissive: spec.color, emissiveIntensity: kind === 'star' ? 1.2 : 0.13, transparent: true }));
  mesh.position.set(x, 0, z);
  if (kind === 'planet') {
    const ring = new T.Mesh(new T.TorusGeometry(0.78, 0.055, 8, 40), new T.MeshStandardMaterial({ color: 0xa5fff0, transparent: true }));
    ring.rotation.x = Math.PI / 2.6; mesh.add(ring);
  }
  const lensEcho = mesh.clone(true);
  const sourceMeshes: T.Mesh[] = [];
  mesh.traverse(o => { if (o instanceof T.Mesh) sourceMeshes.push(o); });
  let echoIndex = 0;
  lensEcho.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const sourceMaterial = sourceMeshes[echoIndex++].material as T.MeshStandardMaterial;
    o.material = new T.MeshBasicMaterial({ color: sourceMaterial.color, transparent: true, opacity: 0, depthWrite: false });
  });
  lensEcho.visible = false;
  const trailGeometry = new T.BufferGeometry();
  trailGeometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(C.trailLength * 3), 3));
  trailGeometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(C.trailLength * 3), 3));
  trailGeometry.setDrawRange(0, 0);
  const trail = new T.Line(trailGeometry, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false }));
  trail.frustumCulled = false;
  return { state: { x, z, vx: 0, vz: 0 }, mesh, lensEcho, kind, held: false, waiting: true, capture: -1, trail, history: [], trailClock: 0 };
}
export function disposeToy(toy: Toy) {
  toy.lensEcho.traverse(o => { if (o instanceof T.Mesh) (o.material as T.Material).dispose(); });
  toy.lensEcho.removeFromParent();
  toy.mesh.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
  toy.mesh.removeFromParent(); toy.trail.removeFromParent(); toy.trail.geometry.dispose(); (toy.trail.material as T.Material).dispose();
}
