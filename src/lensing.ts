import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG as C } from './config';

const lensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new T.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uShadowRadius: { value: 0.04 },
    uEinsteinRadius: { value: C.visuals.einsteinRadius },
    uCriticalCompression: { value: C.visuals.criticalCompression },
    uExtent: { value: C.visuals.lensingExtent },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uCenter;
    uniform float uAspect;
    uniform float uShadowRadius;
    uniform float uEinsteinRadius;
    uniform float uCriticalCompression;
    uniform float uExtent;
    varying vec2 vUv;

    void main() {
      vec2 delta = vUv - uCenter;
      vec2 metric = vec2(delta.x * uAspect, delta.y);
      float distanceFromLens = length(metric);
      float lensRadius = max(uShadowRadius, 0.0001);
      float normalizedRadius = distanceFromLens / lensRadius;

      // Outside the bounded lens region this pass is a single texture copy.
      if (normalizedRadius >= uExtent) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // Point-mass thin-lens equation: beta = theta - theta_E^2 / theta.
      // The signed scale crosses zero at the Einstein radius, so imagery can
      // fold and invert there instead of being uniformly sucked toward a hole.
      float safeRadius = max(normalizedRadius, 0.35);
      float outerFade = 1.0 - smoothstep(uExtent * 0.62, uExtent, normalizedRadius);
      float einsteinSquared = uEinsteinRadius * uEinsteinRadius;
      float lensScale = 1.0 - outerFade * einsteinSquared / (safeRadius * safeRadius);
      // Increase only the source-space slope in a narrow band around theta_E.
      // The zero crossing stays fixed while nearby imagery compresses into a
      // tighter arc; the base lens equation is untouched outside the band.
      float criticalBand = 1.0 - smoothstep(0.0, 0.48,
        abs(normalizedRadius - uEinsteinRadius));
      lensScale *= 1.0 + criticalBand * uCriticalCompression;
      vec2 sourceMetric = metric * lensScale;
      vec2 sourceUv = uCenter + vec2(sourceMetric.x / uAspect, sourceMetric.y);
      vec4 lensed = texture2D(tDiffuse, clamp(sourceUv, vec2(0.001), vec2(0.999)));
      gl_FragColor = lensed;
    }
  `,
};

export function createLensingPass(camera: T.PerspectiveCamera) {
  const pass = new ShaderPass(lensShader);
  const center = new T.Vector3();
  const edge = new T.Vector3();
  const cameraRight = new T.Vector3();

  function update(width: number, height: number) {
    camera.updateMatrixWorld();
    center.set(0, 0, 0).project(camera);
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(C.horizon);
    edge.copy(cameraRight).project(camera);

    pass.uniforms.uCenter.value.set(center.x * 0.5 + 0.5, center.y * 0.5 + 0.5);
    pass.uniforms.uAspect.value = width / Math.max(height, 1);
    pass.uniforms.uShadowRadius.value = Math.abs(edge.x - center.x) * 0.5 * pass.uniforms.uAspect.value;
  }

  return { pass, update };
}
