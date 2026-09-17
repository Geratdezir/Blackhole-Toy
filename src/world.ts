import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG as C } from './config';
import { createBlackHole } from './blackHole';
import { createLensingPass } from './lensing';
export function createWorld(host: HTMLElement) {
  const scene = new T.Scene(); scene.background = new T.Color('#090c1b');
  const camera = new T.PerspectiveCamera(45, 1, 0.1, 250); camera.position.set(0, 22, 15);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableDamping = true; controls.minDistance = 15; controls.maxDistance = 43; controls.minPolarAngle = 0.15; controls.maxPolarAngle = 1.05; controls.target.set(0, 0, 0);
  scene.add(new T.AmbientLight(0xb6c3ff, 2)); const light = new T.PointLight(0xffbe92, 65); light.position.set(0, 5, 0); scene.add(light);
  const blackHole = createBlackHole(); scene.add(blackHole.background);
  const secondaryScene = new T.Scene(); secondaryScene.add(blackHole.secondary);
  const blackHoleOverlay = new T.Scene(); blackHoleOverlay.add(blackHole.overlay);
  const foregroundScene = new T.Scene(); foregroundScene.add(blackHole.foreground);
  foregroundScene.add(new T.AmbientLight(0xb6c3ff, 2));
  const foregroundLight = new T.PointLight(0xffbe92, 65); foregroundLight.position.set(0, 5, 0); foregroundScene.add(foregroundLight);
  const stars = new Float32Array(1800 * 3);
  for (let i = 0; i < stars.length; i += 3) { const a = Math.random() * Math.PI * 2; const r = 40 + Math.random() * 65; stars[i] = Math.cos(a) * r; stars[i + 1] = -12 - Math.random() * 35; stars[i + 2] = Math.sin(a) * r; }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(stars, 3)); scene.add(new T.Points(geometry, new T.PointsMaterial({ color: 0xa5b4dc, size: 0.075, transparent: true, opacity: 0.75 })));
  for (const radius of [5, 9, 13]) {
    const pts = Array.from({ length: 129 }, (_, i) => new T.Vector3(Math.cos(i / 128 * Math.PI * 2) * radius, -0.06, Math.sin(i / 128 * Math.PI * 2) * radius));
    scene.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x546186, transparent: true, opacity: 0.13 })));
  }
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  composer.addPass(new RenderPass(scene, camera));
  const lensing = createLensingPass(camera);
  composer.addPass(lensing.pass);
  const secondaryPass = new RenderPass(secondaryScene, camera);
  secondaryPass.clear = false;
  secondaryPass.clearDepth = true;
  composer.addPass(secondaryPass);
  const overlayPass = new RenderPass(blackHoleOverlay, camera);
  overlayPass.clear = false;
  overlayPass.clearDepth = true;
  composer.addPass(overlayPass);
  const foregroundPass = new RenderPass(foregroundScene, camera);
  foregroundPass.clear = false;
  foregroundPass.clearDepth = true;
  composer.addPass(foregroundPass);
  composer.addPass(new UnrealBloomPass(new T.Vector2(1, 1), C.visuals.bloomStrength, 0.18, C.visuals.bloomThreshold));
  function resize() { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); composer.setSize(host.clientWidth, host.clientHeight); lensing.update(host.clientWidth, host.clientHeight); }
  new ResizeObserver(resize).observe(host); resize();
  return { scene, secondaryScene, foregroundScene, camera, renderer, composer, controls, blackHole, updateLensing: () => lensing.update(host.clientWidth, host.clientHeight), updateObjectLensing: lensing.updateObjects };
}
