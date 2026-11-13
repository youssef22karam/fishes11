import * as THREE from 'three';

export interface FishUniforms {
  uTime: { value: number };
  uGape: { value: number };
  uMaxGape: { value: number };
  uProtrude: { value: number };
  uGular: { value: number };
  uFwd: { value: THREE.Vector2 };
  uHinge: { value: THREE.Vector2 };
  uAmp: { value: number };
  uWave: { value: number };
  uFreq: { value: number };
  uA0: { value: number };
  uPow: { value: number };
  uL: { value: number };
  uX0: { value: number };
  uFlap: { value: number };
  uFlapF: { value: number };
  uFinWave: { value: number };
  uWing: { value: number };
  uWingF: { value: number };
  uSpan: { value: number };
}

export function makeUniforms(): FishUniforms {
  return {
    uTime: { value: 0 },
    uGape: { value: 0 },
    uMaxGape: { value: 0.5 },
    uProtrude: { value: 0 },
    uGular: { value: 0 },
    uFwd: { value: new THREE.Vector2(1, 0) },
    uHinge: { value: new THREE.Vector2() },
    uAmp: { value: 0 },
    uWave: { value: 7 },
    uFreq: { value: 6 },
    uA0: { value: 0.15 },
    uPow: { value: 2 },
    uL: { value: 2 },
    uX0: { value: 1 },
    uFlap: { value: 0 },
    uFlapF: { value: 4 },
    uFinWave: { value: 0 },
    uWing: { value: 0 },
    uWingF: { value: 1.5 },
    uSpan: { value: 1 },
  };
}

const VERT_HEAD = /* glsl */ `
attribute float aJaw;
attribute float aFlap;
attribute float aSide;
attribute vec4 aPlastic;
uniform float uTime, uGape, uMaxGape, uProtrude, uGular, uAmp, uWave, uFreq, uA0, uPow, uL, uX0, uFlap, uFlapF, uFinWave, uWing, uWingF, uSpan;
uniform vec2 uHinge, uFwd;
varying vec2 vFin;
varying float vJaw;
`;

const VERT_DEFORM = /* glsl */ `
vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
vec3 fishP = position;
vFin = uv;
vJaw = aJaw;
float openF = clamp(uGape / max(uMaxGape, 0.05), 0.0, 1.25);

// 1. lower jaw – rotation about the quadrate-articular hinge
if (aJaw > 0.0) {
  float ja = -uGape * aJaw;
  float ca = cos(ja), sa = sin(ja);
  vec2 d = fishP.xy - uHinge;
  fishP.xy = uHinge + vec2(ca*d.x - sa*d.y, sa*d.x + ca*d.y);
  objectNormal.xy = vec2(ca*objectNormal.x - sa*objectNormal.y, sa*objectNormal.x + ca*objectNormal.y);
}
// 2. fleshy head & mouth plasticity (premaxillary protrusion, cheek flare, hyoid depression, stretchy labial web)
if (openF > 0.001) {
  vec2 dUp = vec2(-uFwd.y, uFwd.x);
  if (aPlastic.x > 0.0) {
    vec2 slide = (uFwd * 1.0 - dUp * 0.24) * (openF * uProtrude * aPlastic.x * uL);
    fishP.xy += slide;
  }
  if (aPlastic.y > 0.0) {
    float sz = fishP.z >= 0.0 ? 1.0 : -1.0;
    fishP.z += sz * openF * uGular * 0.58 * aPlastic.y * uL;
  }
  if (aPlastic.z > 0.0) {
    fishP.xy -= dUp * (openF * uGular * aPlastic.z * uL);
  }
  if (aPlastic.w > 0.0) {
    fishP.z *= 1.0 - 0.13 * openF * aPlastic.w;
    fishP.xy += uFwd * (0.007 * openF * aPlastic.w * uL);
  }
}
// 3. fins – paired fins row & feather (aSide=±1), median fins ripple (aSide=0)
if (aFlap > 0.0) {
  float pf = uTime*uFlapF - aFlap*2.35;
  float flex = pow(aFlap, 1.35);
  fishP.z += aSide * flex * uFlap * uL * sin(pf);
  fishP.y += abs(aSide) * flex * uFlap * uL * 0.42 * cos(pf);
  fishP.z += (1.0-abs(aSide)) * flex * uFinWave * uL * sin(uTime*7.0 + fishP.x*14.0/uL);
}
// 4. batoid wings
if (uWing > 0.0) {
  float az = clamp(abs(fishP.z)/uSpan, 0.0, 1.0);
  float sw = (uX0 - fishP.x)/uL;
  float wp = uTime*uWingF - sw*3.5;
  fishP.y += uWing * pow(az, 1.7) * sin(wp) * uSpan;
  float dy = uWing * 1.7 * pow(max(az,1e-3), 0.7) * sin(wp);
  objectNormal = normalize(vec3(objectNormal.x, objectNormal.y, objectNormal.z - dy*sign(fishP.z)*objectNormal.y));
}
// 5. axial undulation (travelling wave, amplitude envelope by swim mode)
{
  float s = clamp((uX0 - fishP.x)/uL, 0.0, 1.45);
  float A = uAmp * (uA0 + (1.0-uA0)*pow(s, uPow));
  float ph = uWave*s - uTime*uFreq;
  fishP.z += A*sin(ph)*uL;
  float dA = uAmp*(1.0-uA0)*uPow*pow(max(s,1e-3), uPow-1.0);
  float th = atan(-(dA*sin(ph) + A*uWave*cos(ph)));
  float c = cos(th), sn = sin(th);
  objectNormal.xz = vec2(c*objectNormal.x - sn*objectNormal.z, sn*objectNormal.x + c*objectNormal.z);
}
`;

export interface FinLook {
  rays: number;
  incise: number;
  membrane: number;
  base: THREE.Color;
  tip: THREE.Color;
  edge: THREE.Color;
  edgeW: number;
  spots: number;
  spotCol: THREE.Color;
}

const FRAG_HEAD = /* glsl */ `
varying vec2 vFin;
varying float vJaw;
uniform float fRays, fIncise, fMembrane, fEdgeW, fSpots, fIsFin;
uniform vec3 fBase, fTip, fEdge, fSpotCol;
float fHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
`;

const FRAG_FIN = /* glsl */ `
if (fIsFin > 0.5) {
  float v = clamp(vFin.y, 0.0, 1.0);
  vec3 col = mix(fBase, fTip, smoothstep(0.0, 1.0, v));
  if (fRays > 0.5) {
    float rx = vFin.x * fRays;
    float rd = abs(fract(rx) - 0.5) * 2.0;          // 1 on primary ray, 0 between
    float ray1 = smoothstep(0.60, 0.94, rd);
    // dichotomous distal ray branching in outer half of soft fin
    float br = abs(fract(rx * 2.0 + 0.25) - 0.5) * 2.0;
    float ray2 = smoothstep(0.68, 0.96, br) * smoothstep(0.45, 0.72, v) * (1.0 - step(0.45, fIncise));
    float ray = max(ray1 * (1.0 - 0.35 * smoothstep(0.55, 0.85, v)), ray2 * 0.78);
    // subtle lepidotrichia joint segmentation along rays
    float joints = 0.92 + 0.08 * sin(v * 52.0);
    // natural delicate scalloping between ray tips + deeper spine incisions
    float effInc = max(fIncise, 0.045);
    float notch = effInc * (1.0 - ray1 * 0.92);
    if (v > 1.0 - notch * 0.72 * (0.45 + 0.55 * abs(sin(rx * 3.14159)))) discard;
    col = mix(col, col * 0.56 * joints, ray * 0.62);
    col = mix(col, col * 1.12, ray * 0.22);
    if (fSpots > 0.0) {
      vec2 g = vec2(vFin.x*fSpots*2.0, v*fSpots*0.8);
      vec2 id = floor(g); vec2 f = fract(g) - 0.5;
      float h = fHash(id);
      float dd = length(f + (vec2(fHash(id+3.1), fHash(id+7.7))-0.5)*0.5);
      col = mix(col, fSpotCol, step(dd, 0.22*h+0.06) * step(0.35, h));
    }
    col = mix(col, fEdge, smoothstep(1.0 - fEdgeW, 1.0 - fEdgeW*0.35, v) * step(0.001, fEdgeW));
    diffuseColor.rgb = col;
    float sheath = 1.0 - smoothstep(0.0, 0.11, v);
    float a = mix(fMembrane, min(1.0, fMembrane + 0.35), ray * 0.88);
    a = mix(a, 1.0, sheath * 0.65);
    a *= 1.0 - smoothstep(0.94, 1.0, v) * 0.45;
    diffuseColor.a *= clamp(a, 0.0, 1.0);
  } else {
    // cartilaginous / fleshy 3D hydrofoil fin (sharks, lobes, adipose)
    float grain = 0.96 + 0.04 * sin(vFin.x * 95.0 + v * 12.0) * smoothstep(0.35, 1.0, v);
    col *= grain;
    col = mix(col, fEdge, smoothstep(1.0 - fEdgeW, 1.0 - fEdgeW*0.35, v) * step(0.001, fEdgeW));
    diffuseColor.rgb = col;
    diffuseColor.a *= clamp(fMembrane, 0.0, 1.0);
  }
}
`;

/** Patch a standard/physical material with the fish deformation pipeline */
export function patchMaterial(mat: THREE.Material, u: FishUniforms, fin?: FinLook) {
  const fu = {
    fRays: { value: fin?.rays ?? 0 },
    fIncise: { value: fin?.incise ?? 0 },
    fMembrane: { value: fin?.membrane ?? 1 },
    fEdgeW: { value: fin?.edgeW ?? 0 },
    fSpots: { value: fin?.spots ?? 0 },
    fIsFin: { value: fin ? 1 : 0 },
    fBase: { value: fin?.base ?? new THREE.Color() },
    fTip: { value: fin?.tip ?? new THREE.Color() },
    fEdge: { value: fin?.edge ?? new THREE.Color() },
    fSpotCol: { value: fin?.spotCol ?? new THREE.Color() },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, fu);
    shader.vertexShader = VERT_HEAD + shader.vertexShader
      .replace('#include <beginnormal_vertex>', VERT_DEFORM)
      .replace('#include <begin_vertex>', 'vec3 transformed = fishP;');
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace(
      '#include <alphamap_fragment>',
      '#include <alphamap_fragment>\n' + FRAG_FIN,
    );
  };
  mat.customProgramCacheKey = () => 'fish-v4';
  return mat;
}

/** make sure a geometry carries the custom attributes */
export function ensureAttrs(g: THREE.BufferGeometry, jaw = 0, flap = 0, side = 0) {
  const n = g.getAttribute('position').count;
  if (!g.getAttribute('aJaw')) g.setAttribute('aJaw', new THREE.BufferAttribute(new Float32Array(n).fill(jaw), 1));
  if (!g.getAttribute('aFlap')) g.setAttribute('aFlap', new THREE.BufferAttribute(new Float32Array(n).fill(flap), 1));
  if (!g.getAttribute('aSide')) g.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(n).fill(side), 1));
  if (!g.getAttribute('aPlastic')) g.setAttribute('aPlastic', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
