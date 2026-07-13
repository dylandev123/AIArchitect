import type { RoofType } from "@/types/house";
import type { RoofFormEntry } from "./types";

export const ROOF_FORMS: Record<RoofType, RoofFormEntry> = {
  "flat": {
    key: "flat", label: "Flat", description: "Low-slope roof with parapet — clean roofline, rooftop potential.",
    compatibleStyles: ["modern-minimalist", "industrial", "mid-century", "tropical"],
  },
  "gable": {
    key: "gable", label: "Gable", description: "Classic double-pitch with triangular end walls.",
    compatibleStyles: ["craftsman", "colonial", "nordic", "craftsman"],
  },
  "hip": {
    key: "hip", label: "Hip", description: "Four-sided pitched roof — sturdy, wind-resistant.",
    compatibleStyles: ["colonial", "mediterranean", "craftsman", "mid-century"],
  },
  "mansard": {
    key: "mansard", label: "Mansard", description: "French two-slope: steep lower band + flat or shallow upper deck.",
    compatibleStyles: ["colonial", "mid-century", "mediterranean"],
  },
  "shed": {
    key: "shed", label: "Shed", description: "Single slope from high back to low front — lean-to modernism.",
    compatibleStyles: ["modern-minimalist", "industrial", "nordic", "mid-century"],
  },
  "butterfly": {
    key: "butterfly", label: "Butterfly", description: "Inverted V — eaves high, valley collects rain at centre.",
    compatibleStyles: ["modern-minimalist", "tropical", "mid-century"],
  },
  "sawtooth": {
    key: "sawtooth", label: "Sawtooth", description: "Multiple north-facing ridges with vertical glazing — studio light.",
    compatibleStyles: ["industrial", "modern-minimalist"],
  },
};
