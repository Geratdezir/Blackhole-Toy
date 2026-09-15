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
    float radial = clamp((radius - 1.55) / 3.25, 0.0, 1.0);
    float angle = atan(vDiskPosition.y, vDiskPosition.x);
    float inward = uTime * 0.075;
    vec2 flow = vec2(angle * 2.4 - uTime * (0.72 - radial * 0.32),
                     radius * 3.6 + inward);
    float broad = fbm(flow * vec2(1.9, 1.0));
    float streaks = fbm(vec2(angle * 8.0 - uTime * (1.1 - radial * 0.45) + broad * 2.0,
                             radius * 7.0 + inward * 2.0));
    float filaments = noise(vec2(angle * 19.0 + radius * 4.0 - uTime * 1.35,
                                 radius * 13.0 + broad * 2.5));
    float structure = mix(broad, streaks, uTurbulence) + filaments * 0.22;
    float gaps = smoothstep(0.29, 0.58, structure);
    float wisps = smoothstep(0.48, 0.82, streaks) * 0.55;
    float edgeFade = smoothstep(1.55, 1.72, radius) * (1.0 - smoothstep(4.25, 4.8, radius));
    float density = clamp((gaps + wisps) * edgeFade, 0.0, 1.0);

    vec3 hot = vec3(2.8, 1.65, 0.55);
    vec3 orange = vec3(1.45, 0.22, 0.035);
    vec3 purple = vec3(0.33, 0.10, 0.72);
    vec3 color = mix(hot, orange, smoothstep(0.03, 0.48, radial));
    color = mix(color, purple, smoothstep(0.58, 1.0, radial));
    float innerHeat = 1.0 + 1.25 * (1.0 - smoothstep(0.0, 0.3, radial));
    color *= innerHeat * (0.5 + structure * 0.85);
    gl_FragColor = vec4(color, density * (0.44 + structure * 0.52));
  }
`;

export function createBlackHole() {
  const group = new T.Group();
  const core = new T.Mesh(
    new T.SphereGeometry(C.horizon, 48, 32),
    new T.MeshBasicMaterial({ color: 0x000005 }),
  );
  group.add(core);

  const halo = new T.Mesh(
    new T.SphereGeometry(C.horizon * 1.18, 32, 20),
    new T.ShaderMaterial({
      uniforms: { uStrength: { value: C.visuals.haloStrength } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uStrength; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(vNormal,vView)),2.4); gl_FragColor=vec4(vec3(0.38,0.16,0.78)*rim*1.5,rim*uStrength); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide,
    }),
  );
  group.add(halo);

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
  const disk = new T.Mesh(new T.RingGeometry(1.55, 4.8, 128, 10), diskMaterial);
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = -0.025;
  group.add(disk);

  const photonMaterial = new T.MeshBasicMaterial({ color: new T.Color().setRGB(4.5, 2.5, 0.9) });
  const photonRing = new T.Mesh(new T.TorusGeometry(C.horizon * 1.105, 0.045, 10, 128), photonMaterial);
  photonRing.rotation.x = Math.PI / 2;
  group.add(photonRing);

  function update(elapsed: number, flash: number) {
    diskMaterial.uniforms.uTime.value = elapsed * C.visuals.diskSpeed;
    photonRing.scale.setScalar(1 + flash * 0.15);
    disk.scale.setScalar(1 + flash * 0.06);
  }

  return { group, disk, photonRing, halo, update };
}
