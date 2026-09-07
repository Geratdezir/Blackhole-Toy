import * as T from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG as C } from './config';
import { predict } from './physics';
import type { Toy } from './objects';
export function setupInput(canvas: HTMLCanvasElement, camera: T.Camera, scene: T.Scene, controls: OrbitControls, toys: Toy[], pull: () => number, aiming: (active: boolean) => void) {
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const preview = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color: 0xb8fff1, size: 0.105, vertexColors: true, transparent: true, depthTest: false })); scene.add(preview);
  const capacity = (Math.ceil(C.predictionSteps / 6) + 2) * 3;
  preview.geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(capacity), 3));
  preview.geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(capacity), 3));
  preview.visible = false; preview.frustumCulled = false;
  const cord = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xffd39c, transparent: true, opacity: 0.8, depthTest: false })); scene.add(cord);
  let held: Toy | undefined, pointer = -1; let start = new T.Vector3(); let velocity = new T.Vector2(); let previous = { vx: 0, vz: 0, waiting: true };
  function point(e: PointerEvent) {
    // Intersect the pointer ray with the fixed XZ play plane, regardless of camera angle.
    const rect = canvas.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
    return ray.ray.intersectPlane(plane, new T.Vector3());
  }
  function refresh() {
    if (!held) return;
    const path = predict({ ...held.state, vx: velocity.x, vz: velocity.y }, pull());
    const positions = preview.geometry.getAttribute('position'), colors = preview.geometry.getAttribute('color');
    path.forEach((p, i) => { const f = 1 - i / path.length * 0.85; positions.setXYZ(i, p.x, 0.08, p.z); colors.setXYZ(i, f * 0.6, f, f * 0.85); });
    positions.needsUpdate = colors.needsUpdate = true; preview.geometry.setDrawRange(0, path.length);
  }
  function finish(cancel: boolean) {
    if (!held) return;
    if (cancel) { held.state.vx = previous.vx; held.state.vz = previous.vz; held.waiting = previous.waiting; }
    else { held.state.vx = velocity.x; held.state.vz = velocity.y; held.waiting = false; held.history.length = 0; held.trail.geometry.setDrawRange(0, 0); }
    held.held = false; held = undefined; controls.enabled = true; preview.visible = cord.visible = false; aiming(false);
    if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer); pointer = -1;
  }
  canvas.addEventListener('pointerdown', e => {
    if (held) { e.stopImmediatePropagation(); return; } if (e.button !== 0) return;
    const p = point(e); if (!p) return;
    // Screen-space grab radius makes small moons comfortable to pick up on touchscreens.
    const rect = canvas.getBoundingClientRect(); let closest = 34; let selected: Toy | undefined;
    for (const toy of toys) { if (toy.capture >= 0) continue; const screen = toy.mesh.position.clone().project(camera); const d = Math.hypot((screen.x + 1) * rect.width / 2 + rect.left - e.clientX, (1 - screen.y) * rect.height / 2 + rect.top - e.clientY); if (d < closest) { closest = d; selected = toy; } }
    if (!selected) return;
    e.stopImmediatePropagation(); controls.enabled = false; held = selected; pointer = e.pointerId; start.copy(p); previous = { vx: held.state.vx, vz: held.state.vz, waiting: held.waiting }; held.held = true; velocity.set(0, 0); canvas.setPointerCapture(pointer); preview.visible = true; aiming(true); refresh();
  }, { capture: true });
  canvas.addEventListener('pointermove', e => {
    if (!held || e.pointerId !== pointer) return; e.stopImmediatePropagation(); const p = point(e); if (!p) return;
    const delta = p.sub(start); delta.clampLength(0, C.maxPull); velocity.set(-delta.x * C.launchStrength, -delta.z * C.launchStrength);
    const origin = new T.Vector3(held.state.x, 0.1, held.state.z); cord.geometry.setFromPoints([origin, origin.clone().add(delta)]); cord.geometry.computeBoundingSphere(); cord.visible = true; refresh();
  }, { capture: true });
  canvas.addEventListener('pointerup', e => { if (held && e.pointerId === pointer) { e.stopImmediatePropagation(); finish(false); } }, { capture: true });
  canvas.addEventListener('pointercancel', e => { if (e.pointerId === pointer) finish(true); });
  canvas.addEventListener('lostpointercapture', e => { if (e.pointerId === pointer) finish(true); });
  window.addEventListener('blur', () => finish(true));
  return { cancel: () => finish(true), refresh };
}
