declare module "n8ao" {
  import type { Camera, Scene } from "three";
  import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";

  export interface N8AOConfiguration {
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: import("three").Color;
    aoSamples: number;
    denoiseSamples: number;
    denoiseRadius: number;
    halfRes: boolean;
    screenSpaceRadius: boolean;
    transparencyAware: boolean;
    gammaCorrection: boolean;
    autoRenderBeauty: boolean;
  }

  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: N8AOConfiguration;
    setQualityMode(mode: "Low" | "Medium" | "High" | "Ultra"): void;
    setSize(width: number, height: number): void;
  }
}
