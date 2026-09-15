export const CONFIG = {
  gravity: 100, defaultPull: 1, horizon: 1.35, softening: 0.55,
  maxAcceleration: 85, step: 1 / 120, drag: 0.006,
  launchStrength: 1.5, maxPull: 8, predictionSteps: 840,
  trailLength: 100, trailInterval: 1 / 30, captureDuration: 0.65,
  escapeRadius: 65, maxObjects: 32, spawnRadius: 9,
  visuals: {
    diskSpeed: 0.8,
    diskTurbulence: 0.72,
    haloStrength: 0.14,
    bloomStrength: 0.32,
    // These landmarks match the rendered disk rather than introducing a
    // separate visual scale for object lensing.
    lensing: { outer: 4.8, inner: 2.9, strongest: 1.72 },
  },
};
