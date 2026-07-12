import type { TimeOfDay } from "@/types/project";

export interface FillLight {
  position: [number, number, number];
  intensity: number;
  color: string;
}

export interface TimeOfDayConfig {
  label: string;
  emoji: string;
  sky: {
    sunPosition: [number, number, number];
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
  };
  sun: { position: [number, number, number]; intensity: number; color: string };
  ambient: { intensity: number; color: string };
  hemi: { sky: string; ground: string; intensity: number };
  fills: FillLight[];
  fog: { color: string; near: number; far: number };
}

export const TIME_OF_DAY: Record<TimeOfDay, TimeOfDayConfig> = {
  morning: {
    label: "Morning",
    emoji: "🌅",
    sky:   { sunPosition: [6, 8, 30], turbidity: 4.0, rayleigh: 3.0, mieCoefficient: 0.005 },
    sun:   { position: [6, 8, 30], intensity: 1.6, color: "#ffcc88" },
    ambient: { intensity: 0.35, color: "#ffe8cc" },
    hemi:  { sky: "#ddaaff", ground: "#5a8830", intensity: 0.35 },
    fills: [{ position: [-22, 18, -14], intensity: 0.18, color: "#ffd0a0" }],
    fog:   { color: "#f0c8a0", near: 120, far: 320 },
  },
  midday: {
    label: "Midday",
    emoji: "☀️",
    sky:   { sunPosition: [40, 35, 20], turbidity: 1.5, rayleigh: 3.0, mieCoefficient: 0.002 },
    sun:   { position: [40, 35, 20], intensity: 3.0, color: "#fffbee" },
    ambient: { intensity: 0.50, color: "#f0f5ff" },
    hemi:  { sky: "#c0d4ff", ground: "#6aaa48", intensity: 0.55 },
    fills: [
      { position: [-22, 18, -14], intensity: 0.26, color: "#dde8ff" },
      { position: [ 20, 10,  18], intensity: 0.18, color: "#ffe8c0" },
    ],
    fog:   { color: "#c4dff0", near: 160, far: 380 },
  },
  sunset: {
    label: "Sunset",
    emoji: "🌇",
    sky:   { sunPosition: [25, 2.5, 18], turbidity: 10.0, rayleigh: 1.0, mieCoefficient: 0.012 },
    sun:   { position: [25, 4, 18], intensity: 1.4, color: "#ff6620" },
    ambient: { intensity: 0.22, color: "#ff9060" },
    hemi:  { sky: "#ff4020", ground: "#301008", intensity: 0.25 },
    fills: [{ position: [-15, 12, -10], intensity: 0.14, color: "#ff9060" }],
    fog:   { color: "#b84020", near: 80, far: 260 },
  },
  night: {
    label: "Night",
    emoji: "🌙",
    sky:   { sunPosition: [0, -30, 0], turbidity: 2.0, rayleigh: 0.2, mieCoefficient: 0.001 },
    sun:   { position: [-5, 30, 10], intensity: 0.28, color: "#b0c8ff" },
    ambient: { intensity: 0.08, color: "#101830" },
    hemi:  { sky: "#101840", ground: "#050505", intensity: 0.12 },
    fills: [{ position: [0, 25, 0], intensity: 0.14, color: "#8090d0" }],
    fog:   { color: "#050810", near: 55, far: 180 },
  },
};
