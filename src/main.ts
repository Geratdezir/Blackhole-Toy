import './style.css';
import { CONFIG as C } from './config';
import { createWorld } from './world';
import { createToy, disposeToy, type Kind, type Toy } from './objects';
import { step } from './physics';
import { updateToy } from './effects';
import { setupInput } from './input';
import { createUI } from './ui';

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const ui = createUI(document.querySelector('#app')!);
const world = createWorld(ui.host);
const toys: Toy[] = []; let pull = C.defaultPull, speed = 1, paused = false, accumulator = 0, flash = 0, captureEnergy = 0, spawnIndex = 0;
const input = setupInput(world.renderer.domElement, world.camera, world.scene, world.controls, toys, () => pull, active => ui.hint(active ? 'Pull back… release to send it flying!' : paused ? 'Time is paused. Press play to see it fly.' : 'Grab a world. Pull back. Let it fly.'));
function spawn(kind: Kind) {
  if (toys.length >= C.maxObjects) { ui.hint('The toybox is full! Reset to make more room.'); return; }
  // Spawn on the camera's far side so the tray cannot cover a new toy.
  const a = Math.atan2(world.camera.position.z, world.camera.position.x) + Math.PI + ((spawnIndex++ * 2.399 + 0.7) % 1.8 - 0.9);
  const radius = Math.min(C.spawnRadius, world.camera.position.length() * 0.29);
  const toy = createToy(kind, Math.cos(a) * radius, Math.sin(a) * radius); toys.push(toy); world.scene.add(toy.mesh, toy.trail); updateToy(toy, 0); ui.hint('Your new world is ready. Pull it back and let go!');
}
function reset() {
  input.cancel(); toys.forEach(disposeToy); toys.length = 0; spawnIndex = 0; pull = 1; speed = 1; paused = false; accumulator = 0; flash = 0; captureEnergy = 0; ui.defaults(); ui.paused(false); world.camera.position.set(0, 22, 15); world.controls.target.set(0, 0, 0); world.controls.update(); spawn('planet');
}
ui.bind(spawn, () => { paused = !paused; accumulator = 0; ui.paused(paused); ui.hint(paused ? 'Time is paused. You can still line up a throw.' : 'Grab a world. Pull back. Let it fly.'); }, reset, n => { pull = n; input.refresh(); }, n => { speed = n; });
reset(); let last = performance.now(), visualTime = 0;
function frame(now: number) {
  requestAnimationFrame(frame); const elapsed = Math.min((now - last) / 1000, 0.05); last = now;
  if (!document.hidden) visualTime += elapsed;
  if (!paused && !document.hidden) accumulator += elapsed * speed;
  while (accumulator >= C.step) {
    let activeCaptureEnergy = 0;
    for (let i = toys.length - 1; i >= 0; i--) {
      const toy = toys[i]; if (toy.held || toy.waiting) continue;
      if (toy.capture >= 0) {
        // Capture animates over several frames before releasing GPU resources.
        const captureT = Math.min(1, toy.capture / C.captureDuration);
        const r = Math.hypot(toy.state.x, toy.state.z);
        const angle = Math.atan2(toy.state.z, toy.state.x);
        const deathSpiralT = smoothstep(0.30, 0.985, captureT);
        const finalInwardSpeed = Math.min(4.0, Math.max(3.0, toy.captureEntryInwardSpeed + 1.0, toy.captureEntryInwardSpeed * 1.35));
        const inwardSpeed = toy.captureEntryInwardSpeed + (finalInwardSpeed - toy.captureEntryInwardSpeed) * Math.pow(deathSpiralT, 1.55);
        const nextR = Math.max(0.03, r - inwardSpeed * C.step);
        const finalTangentialSpeed = Math.min(7.5, Math.max(toy.captureEntryTangentialSpeed + 1.25, toy.captureEntryTangentialSpeed * 1.35));
        const tangentialSpeed = toy.captureEntryTangentialSpeed + (finalTangentialSpeed - toy.captureEntryTangentialSpeed) * Math.pow(deathSpiralT, 1.35);
        const angularSpeed = Math.min(10.0, tangentialSpeed / Math.max(r, 0.32));
        const nextAngle = angle + toy.captureSpin * angularSpeed * C.step;
        const oldX = toy.state.x;
        const oldZ = toy.state.z;
        toy.state.x = Math.cos(nextAngle) * nextR;
        toy.state.z = Math.sin(nextAngle) * nextR;
        toy.state.vx = (toy.state.x - oldX) / C.step;
        toy.state.vz = (toy.state.z - oldZ) / C.step;
        toy.capture += C.step;
        const energyCaptureT = Math.min(1, toy.capture / C.captureDuration);
        const energyCollapseT = smoothstep(0.66, 0.985, energyCaptureT);
        const captureEnergy = Math.pow(energyCollapseT, 2.4);
        activeCaptureEnergy = Math.max(activeCaptureEnergy, captureEnergy);
        if (toy.capture >= C.captureDuration) { disposeToy(toy); toys.splice(i, 1); continue; }
      } else {
        step(toy.state, C.step, pull); const r = Math.hypot(toy.state.x, toy.state.z);
        if (r < C.horizon) {
          const invR = 1 / Math.max(r, 0.001);
          const ux = toy.state.x * invR;
          const uz = toy.state.z * invR;
          const tx = -uz;
          const tz = ux;
          const radialV = toy.state.vx * ux + toy.state.vz * uz;
          const tangentialV = toy.state.vx * tx + toy.state.vz * tz;
          toy.captureSpin = tangentialV < 0 ? -1 : 1;
          toy.captureEntryTangentialSpeed = Math.min(6.0, Math.max(1.8, Math.abs(tangentialV)));
          toy.captureEntryInwardSpeed = Math.min(2.5, Math.max(0.8, Math.max(0, -radialV)));
          toy.capture = 0;
        }
        else if (r > C.escapeRadius) { disposeToy(toy); toys.splice(i, 1); continue; }
      }
      updateToy(toy, C.step);
    }
    captureEnergy = activeCaptureEnergy;
    flash = Math.max(activeCaptureEnergy, flash - C.step * 5.0); accumulator -= C.step;
  }
  world.blackHole.update(visualTime, flash, captureEnergy);
  if (world.controls.enabled) world.controls.update();
  world.updateLensing();
  world.composer.render();
}
requestAnimationFrame(frame);
