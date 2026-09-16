import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG as C } from './config';

const lensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new T.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uShadowRadius: { value: 0.04 },
    uCriticalScale: { value: C.visuals.criticalScale },
    uCriticalWidth: { value: C.visuals.criticalWidth },
    uLensingStrength: { value: C.visuals.lensingStrength },
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
    uniform float uCriticalScale;
    uniform float uCriticalWidth;
    uniform float uLensingStrength;
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

      // Bounded black-hole-style warp: imagery near the critical curve samples
      // farther outward, compressing it inward without a point-lens fling.
      float outerFade = 1.0 - smoothstep(uExtent * 0.68, uExtent, normalizedRadius);
      float criticalDelta = (normalizedRadius - uCriticalScale) / max(uCriticalWidth, 0.0001);
      float ringMask = exp(-0.5 * criticalDelta * criticalDelta);
      float sourceRadius = normalizedRadius + outerFade * uLensingStrength * ringMask;
      vec2 metricDirection = metric / max(distanceFromLens, 0.0001);
      vec2 sourceMetric = metricDirection * sourceRadius * lensRadius;
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
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(C.horizon * C.visuals.shadowScale);
    edge.copy(cameraRight).project(camera);

    pass.uniforms.uCenter.value.set(center.x * 0.5 + 0.5, center.y * 0.5 + 0.5);
    pass.uniforms.uAspect.value = width / Math.max(height, 1);
    pass.uniforms.uShadowRadius.value = Math.abs(edge.x - center.x) * 0.5 * pass.uniforms.uAspect.value;
  }

  return { pass, update };
}
