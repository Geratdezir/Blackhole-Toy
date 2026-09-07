import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG as C } from './config';
export function createWorld(host: HTMLElement) {
  const scene = new T.Scene(); scene.background = new T.Color('#090c1b');
  const camera = new T.PerspectiveCamera(45, 1, 0.1, 250); camera.position.set(0, 22, 15);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableDamping = true; controls.minDistance = 15; controls.maxDistance = 43; controls.minPolarAngle = 0.15; controls.maxPolarAngle = 1.05; controls.target.set(0, 0, 0);
  scene.add(new T.AmbientLight(0xb6c3ff, 2)); const light = new T.PointLight(0xffbe92, 65); light.position.set(0, 5, 0); scene.add(light);
  const core = new T.Mesh(new T.SphereGeometry(C.horizon, 48, 32), new T.MeshBasicMaterial({ color: 0x010208 })); scene.add(core);
  const ring = new T.Mesh(new T.TorusGeometry(C.horizon * 1.12, 0.065, 12, 96), new T.MeshBasicMaterial({ color: 0xffd4a0 })); ring.rotation.x = Math.PI / 2; scene.add(ring);
  const glow = new T.Group();
  for (let i = 0; i < 12; i++) {
    const r = new T.Mesh(new T.RingGeometry(1.53 + i * 0.095, 1.64 + i * 0.095, 96), new T.MeshBasicMaterial({ color: i < 4 ? 0xffb77c : 0x987bff, side: T.DoubleSide, transparent: true, opacity: 0.2 * (1 - i / 13), depthWrite: false, blending: T.AdditiveBlending })); r.rotation.x = -Math.PI / 2; glow.add(r);
  }
  scene.add(glow);
  const stars = new Float32Array(1800 * 3);
  for (let i = 0; i < stars.length; i += 3) { const a = Math.random() * Math.PI * 2; const r = 40 + Math.random() * 65; stars[i] = Math.cos(a) * r; stars[i + 1] = -12 - Math.random() * 35; stars[i + 2] = Math.sin(a) * r; }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(stars, 3)); scene.add(new T.Points(geometry, new T.PointsMaterial({ color: 0xa5b4dc, size: 0.075, transparent: true, opacity: 0.75 })));
  for (const radius of [5, 9, 13]) {
    const pts = Array.from({ length: 129 }, (_, i) => new T.Vector3(Math.cos(i / 128 * Math.PI * 2) * radius, -0.06, Math.sin(i / 128 * Math.PI * 2) * radius));
    scene.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x546186, transparent: true, opacity: 0.13 })));
  }
  function resize() { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }
  new ResizeObserver(resize).observe(host); resize();
  return { scene, camera, renderer, controls, ring, glow };
}
