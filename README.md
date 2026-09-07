# Black Hole Toybox

A small 3D slingshot playground. Spawn a world, pull it back, and send it around a black hole.

## Run locally

Install Node.js 22.12+ (with npm), then from this folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

Deploy `dist/` to a static web host. No backend, accounts, runtime services, or remote assets are required. `npm test` runs deterministic physics checks.

## Controls

- Tap a tray button to add a planet, moon, asteroid, or star. New objects wait for a throw.
- Press an object, pull away from the desired direction, and release. Dots predict the throw; the warm line shows your pull. Moving objects can be grabbed again.
- Drag empty space to orbit the camera. Scroll or pinch to zoom. Camera panning is disabled.
- Adjust Black hole pull or Time, pause/play, or reset the entire toybox.
- A canceled gesture restores the object's prior velocity. A throw while paused starts when Play is pressed.

## Architecture

- `src/main.ts`: fixed timestep loop, lifecycle, capture detection, UI wiring.
- `src/config.ts`: gameplay constants.
- `src/physics.ts`: plain XZ state, softened gravity, semi-implicit Euler, copied-state prediction.
- `src/world.ts`: Three.js scene, black hole, starfield, lighting, constrained OrbitControls.
- `src/objects.ts`: four extensible object definitions, meshes, resource cleanup.
- `src/input.ts`: pointer capture, screen-space picking, ray/plane drag conversion, launch preview.
- `src/effects.ts`: reversible radial stretching, capture shrink/fade, short colored trails.
- `src/ui.ts` and `src/style.css`: responsive vanilla DOM controls.

All playable centers stay at Y=0; the camera always targets the origin. Physics runs at 120 Hz with bounded catch-up. Prediction uses the same step for up to seven simulated seconds. Objects do not collide or attract each other.

## Tuning

`CONFIG` centralizes gravity (100), default pull (1), horizon radius (1.35), softening (0.55), acceleration cap (85), timestep (1/120), gentle orbital drag (0.006), launch strength (1.5), maximum pull (8), prediction steps (840), trail length (100 samples), capture duration (0.65 seconds), spawn radius (9), escape radius (65), and object limit (32). Object sizes/colors live in `TYPES`.

## V1 limitations

This is playful approximate gravity, not astrophysics. Rendering uses inexpensive geometry without lensing or bloom. Dots predict current pull and stop at capture/escape; changing pull changes the future. Trails use a bounded sampling buffer without interpolation. The play plane is fixed; no free 3D throws, collisions, fragmentation, persistence, or audio. Spawned objects wait in place until released. Real iPad performance and multi-touch behavior need device testing.

## Next three improvements

1. Test with children on real tablets and tune grab radius, launch strength, and framing.
2. Add optional lightweight synthesized launch/capture sounds with a mute control.
3. Profile on iPad and pool trail history vectors if allocation becomes a bottleneck.
