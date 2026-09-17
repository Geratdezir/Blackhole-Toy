import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG as C } from './config';
import type { Toy } from './objects';

const lensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new T.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uShadowRadius: { value: 0.04 },
    uLensStrength: { value: C.visuals.backgroundLensStrength },
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
    uniform float uLensStrength;
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

      // Mild monotonic deflection for background and scene objects. The disk's
      // secondary image is constructed from its own camera-aware geometry.
      float safeRadius = max(normalizedRadius, 0.65);
      float outerFade = 1.0 - smoothstep(uExtent * 0.55, uExtent, normalizedRadius);
      float deflection = uLensStrength * outerFade / safeRadius;
      float sourceRadius = max(0.0, normalizedRadius - deflection);
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
  const centerView = new T.Vector3();
  const objectView = new T.Vector3();
  const objectScreen = new T.Vector3();
  const echoView = new T.Vector3();
  const sourceDirection = new T.Vector2();

  function smoothstep(edge0: number, edge1: number, value: number) {
    const t = T.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function update(width: number, height: number) {
    camera.updateMatrixWorld();
    center.set(0, 0, 0).project(camera);
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(C.horizon * C.visuals.shadowScale);
    edge.copy(cameraRight).project(camera);

    pass.uniforms.uCenter.value.set(center.x * 0.5 + 0.5, center.y * 0.5 + 0.5);
    pass.uniforms.uAspect.value = width / Math.max(height, 1);
    pass.uniforms.uShadowRadius.value = Math.abs(edge.x - center.x) * 0.5 * pass.uniforms.uAspect.value;
  }

  function updateObjects(toys: Toy[], backgroundScene: T.Scene, foregroundScene: T.Scene) {
    camera.updateMatrixWorld();
    centerView.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    center.set(0, 0, 0).project(camera);
    const aspect = pass.uniforms.uAspect.value as number;
    const projectedShadowRadius = Math.max(pass.uniforms.uShadowRadius.value as number, 0.0001);
    const shadowRadius = C.horizon * C.visuals.shadowScale;
    const criticalRadius = shadowRadius * C.visuals.criticalScale;

    for (const toy of toys) {
      objectView.copy(toy.mesh.position).applyMatrix4(camera.matrixWorldInverse);
      const isBehind = objectView.z < centerView.z;
      const targetScene = isBehind ? backgroundScene : foregroundScene;
      if (toy.mesh.parent !== targetScene) targetScene.add(toy.mesh);

      if (!isBehind || toy.capture >= 0) {
        toy.lensEcho.visible = false;
        continue;
      }

      objectScreen.copy(toy.mesh.position).project(camera);
      const screenX = (objectScreen.x - center.x) * aspect;
      const screenY = objectScreen.y - center.y;
      const normalizedScreenRadius = Math.hypot(screenX, screenY) / projectedShadowRadius;
      const alignment = 1 - smoothstep(C.visuals.objectLensInner, C.visuals.objectLensOuter, normalizedScreenRadius);
      const behindFactor = smoothstep(0, shadowRadius, centerView.z - objectView.z);
      const strength = T.MathUtils.clamp(alignment * behindFactor, 0, 1);
      if (strength < 0.001) {
        toy.lensEcho.visible = false;
        continue;
      }

      sourceDirection.set(objectView.x - centerView.x, objectView.y - centerView.y);
      if (sourceDirection.lengthSq() < 0.000001) sourceDirection.set(1, 0);
      else sourceDirection.normalize();
      const echoRadius = T.MathUtils.lerp(shadowRadius * 1.01, criticalRadius, strength);
      echoView.set(
        centerView.x - sourceDirection.x * echoRadius,
        centerView.y - sourceDirection.y * echoRadius,
        centerView.z,
      ).applyMatrix4(camera.matrixWorld);
      toy.lensEcho.position.copy(echoView);
      toy.lensEcho.quaternion.copy(toy.mesh.quaternion);
      const echoScale = T.MathUtils.lerp(C.visuals.objectLensMinScale, C.visuals.objectLensMaxScale, strength);
      toy.lensEcho.scale.copy(toy.mesh.scale).multiplyScalar(echoScale);
      toy.lensEcho.traverse(o => {
        if (o instanceof T.Mesh) (o.material as T.MeshBasicMaterial).opacity = C.visuals.objectLensOpacity * strength;
      });
      toy.lensEcho.visible = true;
    }
  }

  return { pass, update, updateObjects };
}
