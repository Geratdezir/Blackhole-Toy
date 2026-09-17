import * as T from 'three';
import { CONFIG as C } from './config';

const diskVertex = /* glsl */`
  varying vec2 vDiskPosition;
  void main() {
    vDiskPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const diskFragment = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uTurbulence;
  varying vec2 vDiskPosition;

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
    float radial = clamp((radius - 1.61) / 3.19, 0.0, 1.0);
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
    float innerGap = smoothstep(1.61, 1.83, radius);
    float edgeFade = innerGap * (1.0 - smoothstep(4.1, 4.72, radius));
    float density = clamp((gaps + wisps) * edgeFade * sectorMask, 0.0, 0.82);

    vec3 hot = vec3(1.96, 1.02, 0.34);
    vec3 orange = vec3(1.15, 0.16, 0.025);
    vec3 purple = vec3(0.2, 0.045, 0.38);
    vec3 color = mix(hot, orange, smoothstep(0.03, 0.48, radial));
    float coolPatch = smoothstep(0.62, 1.0, radial) * smoothstep(0.42, 0.76, broad);
    color = mix(color, purple, coolPatch * 0.58);
    float innerHeat = 1.0 + 0.68 * (1.0 - smoothstep(0.0, 0.3, radial));
    color *= innerHeat * (0.38 + structure * 0.62);
    gl_FragColor = vec4(color, density * (0.3 + structure * 0.48));
  }
`;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createBlackHole() {
  const group = new T.Group();
  const overlay = new T.Group();
  const core = new T.Mesh(
    new T.SphereGeometry(C.horizon, 48, 32),
    new T.MeshBasicMaterial({ color: 0x000005 }),
  );
  overlay.add(core);

  const halo = new T.Mesh(
    new T.SphereGeometry(C.horizon * 1.18, 32, 20),
    new T.ShaderMaterial({
      uniforms: { uStrength: { value: C.visuals.haloStrength } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uStrength; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(vNormal,vView)),2.4); gl_FragColor=vec4(vec3(0.38,0.16,0.78)*rim*1.5,rim*uStrength); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide,
    }),
  );
  overlay.add(halo);

  const diskMaterial = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTurbulence: { value: C.visuals.diskTurbulence },
    },
    vertexShader: diskVertex,
    fragmentShader: diskFragment,
    side: T.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const disk = new T.Mesh(new T.RingGeometry(1.61, 4.8, 128, 10), diskMaterial);
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = -0.025;
  group.add(disk);

  const photonMaterial = new T.MeshBasicMaterial({ color: new T.Color().setRGB(3.4, 1.65, 0.42) });
  const photonRing = new T.Mesh(new T.TorusGeometry(C.horizon * 1.075, 0.024, 8, 128), photonMaterial);
  photonRing.rotation.x = Math.PI / 2;
  overlay.add(photonRing);

  function update(elapsed: number, flash: number) {
    diskMaterial.uniforms.uTime.value = elapsed * C.visuals.diskSpeed;
    const flashProgress = 1 - Math.min(1, Math.max(0, flash));
    const flashPulse = smoothstep(0, 0.12, flashProgress) * (1 - smoothstep(0.12, 1, flashProgress));
    photonMaterial.color.setRGB(3.4, 1.65, 0.42).multiplyScalar(1 + flashPulse * 1.35);
    halo.material.uniforms.uStrength.value = C.visuals.haloStrength + flashPulse * 0.32;
  }

  return { group, overlay, disk, photonRing, halo, update };
}
