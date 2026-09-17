import * as T from 'three';
import { CONFIG as C } from './config';

const diskVertex = /* glsl */`
  uniform float uDiskPass;
  uniform float uCriticalRadius;
  uniform float uDiskInnerRadius;
  uniform float uDiskLensOuterRadius;
  uniform float uDiskLensSpread;
  varying vec2 vDiskPosition;
  varying float vFarMask;
  varying float vLensMask;
  void main() {
    vDiskPosition = position.xy;
    vec4 centerView = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 vertexView = modelViewMatrix * vec4(position, 1.0);
    float diskRadius = length(position.xy);
    float normalizedFarDepth = (centerView.z - vertexView.z) / max(diskRadius, 0.0001);
    vFarMask = smoothstep(0.01, 0.18, normalizedFarDepth);
    vLensMask = 1.0;

    if (uDiskPass > 0.5 && uDiskPass < 1.5) {
      float sourceMask = 1.0 - smoothstep(uDiskInnerRadius, uDiskLensOuterRadius, diskRadius);
      vec2 viewOffset = vertexView.xy - centerView.xy;
      float projectedRadius = length(viewOffset);
      vec2 viewDirection = viewOffset / max(projectedRadius, 0.0001);
      float targetRadius = uCriticalRadius
        + max(diskRadius - uDiskInnerRadius, 0.0) * uDiskLensSpread;
      float warpDistance = max(targetRadius - projectedRadius, 0.0);
      float warpGate = smoothstep(0.0, uCriticalRadius * 0.10, warpDistance);
      vLensMask = vFarMask * sourceMask * warpGate;
      float warpedRadius = projectedRadius + warpDistance * vLensMask;
      vertexView.xy = centerView.xy + viewDirection * warpedRadius;
    }

    gl_Position = projectionMatrix * vertexView;
  }
`;

const diskFragment = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uTurbulence;
  uniform float uDiskPass;
  uniform float uDiskInnerRadius;
  uniform float uDiskOuterRadius;
  uniform float uDiskInnerFadeWidth;
  uniform float uDiskLensOpacity;
  varying vec2 vDiskPosition;
  varying float vFarMask;
  varying float vLensMask;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0, amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = mat2(1.65, 1.12, -1.12, 1.65) * p + 0.17;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    float radius = length(vDiskPosition);
    float radial = clamp((radius - uDiskInnerRadius) / (uDiskOuterRadius - uDiskInnerRadius), 0.0, 1.0);
    float angle = atan(vDiskPosition.y, vDiskPosition.x);
    float inward = uTime * 0.075;
    vec2 flow = vec2(angle * 2.4 - uTime * (0.72 - radial * 0.32),
                     radius * 3.6 + inward);
    float broad = fbm(flow * vec2(1.9, 1.0));
    float streaks = fbm(vec2(angle * 8.0 - uTime * (1.1 - radial * 0.45) + broad * 2.0,
                             radius * 7.0 + inward * 2.0));
    float filaments = noise(vec2(angle * 19.0 + radius * 4.0 - uTime * 1.35,
                                 radius * 13.0 + broad * 2.5));
    float structure = mix(broad, streaks, uTurbulence) + filaments * 0.2;
    float gaps = smoothstep(0.47, 0.7, structure);
    float wisps = smoothstep(0.61, 0.86, streaks) * 0.4;
    float sectors = noise(vec2(angle * 2.1 - uTime * 0.12, floor(radius * 1.6)));
    float sectorMask = mix(0.28, 1.0, smoothstep(0.25, 0.72, sectors));
    float innerGap = smoothstep(uDiskInnerRadius, uDiskInnerRadius + uDiskInnerFadeWidth, radius);
    float edgeFade = innerGap * (1.0 - smoothstep(4.1, 4.72, radius));
    float density = clamp((gaps + wisps) * edgeFade * sectorMask, 0.0, 0.82);

    vec3 hot = vec3(1.82, 0.91, 0.28);
    vec3 orange = vec3(1.15, 0.16, 0.025);
    vec3 purple = vec3(0.2, 0.045, 0.38);
    vec3 color = mix(hot, orange, smoothstep(0.03, 0.48, radial));
    float coolPatch = smoothstep(0.62, 1.0, radial) * smoothstep(0.42, 0.76, broad);
    color = mix(color, purple, coolPatch * 0.58);
    float innerHeat = 1.0 + 0.55 * (1.0 - smoothstep(0.0, 0.3, radial));
    color *= innerHeat * (0.38 + structure * 0.62);
    float passAlpha = uDiskPass < 0.5
      ? vFarMask
      : (uDiskPass < 1.5 ? vLensMask * uDiskLensOpacity : 1.0 - vFarMask);
    gl_FragColor = vec4(color, density * (0.3 + structure * 0.48) * passAlpha);
  }
`;

export function createBlackHole() {
  const background = new T.Group();
  const secondary = new T.Group();
  const overlay = new T.Group();
  const foreground = new T.Group();
  const shadowRadius = C.horizon * C.visuals.shadowScale;
  const core = new T.Mesh(
    new T.SphereGeometry(shadowRadius, 48, 32),
    new T.MeshBasicMaterial({ color: 0x000005 }),
  );
  overlay.add(core);

  const halo = new T.Mesh(
    new T.SphereGeometry(shadowRadius * 1.12, 32, 20),
    new T.ShaderMaterial({
      uniforms: { uStrength: { value: C.visuals.haloStrength } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uStrength; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(vNormal,vView)),2.4); gl_FragColor=vec4(vec3(0.38,0.16,0.78)*rim*1.5,rim*uStrength); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide,
    }),
  );
  overlay.add(halo);

  const diskUniforms = (diskPass: number) => ({
      uTime: { value: 0 },
      uTurbulence: { value: C.visuals.diskTurbulence },
      uDiskPass: { value: diskPass },
      uCriticalRadius: { value: shadowRadius * C.visuals.criticalScale },
      uDiskInnerRadius: { value: C.visuals.diskInnerRadius },
      uDiskOuterRadius: { value: C.visuals.diskOuterRadius },
      uDiskInnerFadeWidth: { value: C.visuals.diskInnerFadeWidth },
      uDiskLensOuterRadius: { value: C.visuals.diskLensOuterRadius },
      uDiskLensSpread: { value: C.visuals.diskLensSpread },
      uDiskLensOpacity: { value: C.visuals.diskLensOpacity },
  });
  const createDiskMaterial = (diskPass: number) => new T.ShaderMaterial({
    uniforms: diskUniforms(diskPass),
    vertexShader: diskVertex,
    fragmentShader: diskFragment,
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const diskGeometry = new T.RingGeometry(C.visuals.diskInnerRadius, C.visuals.diskOuterRadius, 128, 10);
  const backDiskMaterial = createDiskMaterial(0);
  const lensedDiskMaterial = createDiskMaterial(1);
  const frontDiskMaterial = createDiskMaterial(2);
  const backDisk = new T.Mesh(diskGeometry, backDiskMaterial);
  const lensedDisk = new T.Mesh(diskGeometry, lensedDiskMaterial);
  const frontDisk = new T.Mesh(diskGeometry, frontDiskMaterial);
  for (const mesh of [backDisk, lensedDisk, frontDisk]) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.025;
  }
  background.add(backDisk);
  secondary.add(lensedDisk);
  foreground.add(frontDisk);

  const photonMaterial = new T.MeshBasicMaterial({ color: new T.Color().setRGB(3.4, 1.65, 0.42) });
  const photonRing = new T.Mesh(new T.TorusGeometry(shadowRadius * C.visuals.criticalScale, 0.02, 8, 128), photonMaterial);
  photonRing.rotation.x = Math.PI / 2;
  overlay.add(photonRing);

  function update(elapsed: number, flash: number) {
    for (const material of [backDiskMaterial, lensedDiskMaterial, frontDiskMaterial]) {
      material.uniforms.uTime.value = elapsed * C.visuals.diskSpeed;
    }
    photonRing.scale.setScalar(1 + flash * 0.15);
    backDisk.scale.setScalar(1 + flash * 0.06);
    lensedDisk.scale.copy(backDisk.scale);
    frontDisk.scale.copy(backDisk.scale);
  }

  return { background, secondary, overlay, foreground, backDisk, lensedDisk, frontDisk, photonRing, halo, update };
}
