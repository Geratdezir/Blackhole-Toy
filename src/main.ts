import './style.css';
import { CONFIG as C } from './config';
import { createWorld } from './world';
import { createToy, disposeToy, type Kind, type Toy } from './objects';
import { step } from './physics';
import { updateToy } from './effects';
import { setupInput } from './input';
import { createUI } from './ui';
const ui = createUI(document.querySelector('#app')!);
const world = createWorld(ui.host);
const toys: Toy[] = []; let pull = C.defaultPull, speed = 1, paused = false, accumulator = 0, flash = 0, spawnIndex = 0;
const input = setupInput(world.renderer.domElement, world.camera, world.scene, world.controls, toys, () => pull, active => ui.hint(active ? 'Pull back… release to send it flying!' : paused ? 'Time is paused. Press play to see it fly.' : 'Grab a world. Pull back. Let it fly.'));
function spawn(kind: Kind) {
  if (toys.length >= C.maxObjects) { ui.hint('The toybox is full! Reset to make more room.'); return; }
  // Spawn on the camera's far side so the tray cannot cover a new toy.
  const a = Math.atan2(world.camera.position.z, world.camera.position.x) + Math.PI + ((spawnIndex++ * 2.399 + 0.7) % 1.8 - 0.9);
  const radius = Math.min(C.spawnRadius, world.camera.position.length() * 0.29);
  const toy = createToy(kind, Math.cos(a) * radius, Math.sin(a) * radius); toys.push(toy); world.scene.add(toy.mesh, toy.trail); updateToy(toy, 0); ui.hint('Your new world is ready. Pull it back and let go!');
}
function reset() {
  input.cancel(); toys.forEach(disposeToy); toys.length = 0; spawnIndex = 0; pull = 1; speed = 1; paused = false; accumulator = 0; flash = 0; ui.defaults(); ui.paused(false); world.camera.position.set(0, 22, 15); world.controls.target.set(0, 0, 0); world.controls.update(); spawn('planet');
}
ui.bind(spawn, () => { paused = !paused; accumulator = 0; ui.paused(paused); ui.hint(paused ? 'Time is paused. You can still line up a throw.' : 'Grab a world. Pull back. Let it fly.'); }, reset, n => { pull = n; input.refresh(); }, n => { speed = n; });
reset(); let last = performance.now(), visualTime = 0;
function frame(now: number) {
  requestAnimationFrame(frame); const elapsed = Math.min((now - last) / 1000, 0.05); last = now;
  if (!document.hidden) visualTime += elapsed;
  if (!paused && !document.hidden) accumulator += elapsed * speed;
  while (accumulator >= C.step) {
    for (let i = toys.length - 1; i >= 0; i--) {
      const toy = toys[i]; if (toy.held || toy.waiting) continue;
      if (toy.capture >= 0) {
        // Capture animates over several frames before releasing GPU resources.
        const captureT = Math.min(1, toy.capture / C.captureDuration);
        const r = Math.hypot(toy.state.x, toy.state.z);
        const invR = 1 / Math.max(r, 0.001);
        const dirX = -toy.state.x * invR;
        const dirZ = -toy.state.z * invR;
        const velocityDamping = 0.985 - 0.11 * captureT;
        const capturePull = 7 + 18 * captureT;
        toy.state.vx = (toy.state.vx + dirX * capturePull * C.step) * velocityDamping;
        toy.state.vz = (toy.state.vz + dirZ * capturePull * C.step) * velocityDamping;
        toy.state.x += toy.state.vx * C.step;
        toy.state.z += toy.state.vz * C.step;
        toy.capture += C.step;
        if (toy.capture >= C.captureDuration) { disposeToy(toy); toys.splice(i, 1); continue; }
      } else {
        step(toy.state, C.step, pull); const r = Math.hypot(toy.state.x, toy.state.z);
        if (r < C.horizon) { toy.capture = 0; flash = 1; }
        else if (r > C.escapeRadius) { disposeToy(toy); toys.splice(i, 1); continue; }
      }
      updateToy(toy, C.step);
    }
    flash = Math.max(0, flash - C.step * 1.8); accumulator -= C.step;
  }
  world.blackHole.update(visualTime, flash);
  if (world.controls.enabled) world.controls.update();
  world.updateLensing();
  world.composer.render();
}
requestAnimationFrame(frame);
