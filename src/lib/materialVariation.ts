import type * as THREE from "three";

type Shader = Parameters<THREE.Material["onBeforeCompile"]>[0];

const NOISE_GLSL = /* glsl */ `
float macroHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float macroNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(macroHash(i), macroHash(i + vec3(1, 0, 0)), f.x), mix(macroHash(i + vec3(0, 1, 0)), macroHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(macroHash(i + vec3(0, 0, 1)), macroHash(i + vec3(1, 0, 1)), f.x), mix(macroHash(i + vec3(0, 1, 1)), macroHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
`;

/**
 * Breaks up repeat tiling and flat colour on large surfaces: world-space value noise gently shifts brightness and
 * roughness (so a wall reads as patchy weathered render, not one repeating photo), and vertical faces darken slightly
 * where they meet the ground — cheap "dirt at the base" grounding. Shared by every surface that opts in via
 * `onBeforeCompile`, so all of them reuse one compiled program.
 */
export function macroVariation(shader: Shader): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nvarying vec3 vMacroPos;\nvarying float vMacroUp;`)
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vMacroPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vMacroUp = abs(normalize(mat3(modelMatrix) * objectNormal).y);`
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\nvarying vec3 vMacroPos;\nvarying float vMacroUp;\n${NOISE_GLSL}`)
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float macroMix = macroNoise(vMacroPos * 0.16) * 0.6 + macroNoise(vMacroPos * 0.55) * 0.3 + macroNoise(vMacroPos * 2.1) * 0.1;
      diffuseColor.rgb *= mix(0.86, 1.1, macroMix);
      float macroBase = (1.0 - vMacroUp) * (1.0 - smoothstep(0.0, 0.7, vMacroPos.y));
      diffuseColor.rgb *= 1.0 - 0.2 * macroBase;`
    )
    .replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor * mix(0.92, 1.08, macroMix), 0.04, 1.0);`
    );
}

export const macroVariationCacheKey = (): string => "macro-variation-v1";
