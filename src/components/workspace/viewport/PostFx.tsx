"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { N8AOPass } from "n8ao";

/**
 * Screen-space ambient occlusion (N8AO) plus tone mapping and SMAA, replacing R3F's direct render. The AO darkens
 * creases, wall/ground joins and window reveals so the scene gets depth at normal zoom. Runs half-res with a small
 * sample count to stay light in the browser. If the composer can't be built the scene keeps R3F's default render.
 */
export function PostFx({ exposure }: { exposure: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    try {
      const target = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType });
      const c = new EffectComposer(gl, target);
      const ao = new N8AOPass(scene, camera, size.width, size.height);
      ao.configuration.aoRadius = 1.6;
      ao.configuration.distanceFalloff = 0.9;
      ao.configuration.intensity = 3.2;
      ao.configuration.aoSamples = 12;
      ao.configuration.denoiseSamples = 6;
      ao.configuration.denoiseRadius = 10;
      ao.configuration.halfRes = true;
      ao.configuration.transparencyAware = true;
      ao.configuration.gammaCorrection = false;
      ao.configuration.color = new THREE.Color("#1c2410");
      c.addPass(ao);
      c.addPass(new OutputPass());
      c.addPass(new SMAAPass());
      return c;
    } catch {
      return null;
    }
    // Rebuilt only if the renderer, scene or camera change; size is applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    if (!composer) return;
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);

  useEffect(() => () => composer?.dispose(), [composer]);

  // Priority > 0 takes over rendering from R3F.
  useFrame((state, delta) => {
    state.gl.toneMappingExposure = exposure;
    composer?.render(delta);
  }, composer ? 1 : 0);

  return null;
}
