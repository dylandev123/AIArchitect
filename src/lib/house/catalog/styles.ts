import type { StyleKey } from "@/types/house";
import type { StylePreset } from "./types";

export const STYLE_PRESETS: Record<StyleKey, StylePreset> = {
  "mediterranean": {
    key: "mediterranean", label: "Mediterranean", description: "Sun-baked stucco, terracotta tiles, arched openings and wrought iron.",
    roofType: "hip",
    defaults: {
      wallFinish:   "rough-stucco",
      windowStyle:  "arched",
      doorStyle:    "double",
      railingStyle: "iron",
      columnStyle:  "square-pilaster",
      patioSurface: "terracotta",
      poolTile:     "mosaic-tile",
    },
    materials: {
      exterior: { material: "stucco",     color: "#e8d8b8" },
      roof:     { material: "terracotta", color: "#c06840" },
      trim:     { material: "stone",      color: "#c4b89c" },
      decking:  { material: "stone",      color: "#c8b89c" },
    },
  },

  "modern-minimalist": {
    key: "modern-minimalist", label: "Modern Minimalist", description: "Smooth render, flat or butterfly roof, oversized glazing, no ornament.",
    roofType: "flat",
    defaults: {
      wallFinish:   "smooth-stucco",
      windowStyle:  "picture",
      doorStyle:    "flush",
      railingStyle: "glass-panel",
      columnStyle:  "none",
      patioSurface: "concrete",
      poolTile:     "mosaic-tile",
    },
    materials: {
      exterior: { material: "render",   color: "#f0f0ec" },
      roof:     { material: "concrete", color: "#c0bcb8" },
      trim:     { material: "metal",    color: "#2a2e36" },
      decking:  { material: "concrete", color: "#c0bcb8" },
    },
  },

  "craftsman": {
    key: "craftsman", label: "Craftsman", description: "Board-and-batten siding, wide gable overhangs, chunky timber posts.",
    roofType: "gable",
    defaults: {
      wallFinish:   "board-batten",
      windowStyle:  "double-hung",
      doorStyle:    "paneled",
      railingStyle: "timber",
      columnStyle:  "craftsman-post",
      patioSurface: "brick-paver",
      poolTile:     "pebble",
    },
    materials: {
      exterior: { material: "timber", color: "#7a5632" },
      roof:     { material: "slate",  color: "#4a5058" },
      trim:     { material: "timber", color: "#4a3018" },
      decking:  { material: "timber", color: "#b88040" },
    },
  },

  "industrial": {
    key: "industrial", label: "Industrial", description: "Exposed concrete and steel, sawtooth roof, cable railings.",
    roofType: "sawtooth",
    defaults: {
      wallFinish:   "split-face-block",
      windowStyle:  "picture",
      doorStyle:    "flush",
      railingStyle: "cable",
      columnStyle:  "steel-section",
      patioSurface: "concrete",
      poolTile:     "slate-tile",
    },
    materials: {
      exterior: { material: "concrete", color: "#9c9890" },
      roof:     { material: "zinc",     color: "#7a8490" },
      trim:     { material: "metal",    color: "#1a1e26" },
      decking:  { material: "concrete", color: "#a8a4a0" },
    },
  },

  "colonial": {
    key: "colonial", label: "Colonial", description: "Symmetrical brick or clapboard, hip roof with dormers, paneled doors.",
    roofType: "hip",
    defaults: {
      wallFinish:   "brick",
      windowStyle:  "double-hung",
      doorStyle:    "paneled",
      railingStyle: "picket",
      columnStyle:  "square-pilaster",
      patioSurface: "brick-paver",
      poolTile:     "travertine",
    },
    materials: {
      exterior: { material: "brick",  color: "#b05038" },
      roof:     { material: "slate",  color: "#3c4048" },
      trim:     { material: "wood",   color: "#f0ece4" },
      decking:  { material: "timber", color: "#9c7848" },
    },
  },

  "tropical": {
    key: "tropical", label: "Tropical", description: "Elevated pavilion, louvered windows, teak decks, lush patio edges.",
    roofType: "hip",
    defaults: {
      wallFinish:   "smooth-stucco",
      windowStyle:  "louvered",
      doorStyle:    "glass-panel",
      railingStyle: "cable",
      columnStyle:  "square-pilaster",
      patioSurface: "teak-deck",
      poolTile:     "mosaic-tile",
    },
    materials: {
      exterior: { material: "stucco",  color: "#f4ede0" },
      roof:     { material: "metal",   color: "#5a7a6a" },
      trim:     { material: "timber",  color: "#8a6040" },
      decking:  { material: "timber",  color: "#b88848" },
    },
  },

  "nordic": {
    key: "nordic", label: "Nordic", description: "Dark board-cladding, shed or gable roof, large picture windows.",
    roofType: "shed",
    defaults: {
      wallFinish:   "board-batten",
      windowStyle:  "picture",
      doorStyle:    "flush",
      railingStyle: "cable",
      columnStyle:  "board-strip",
      patioSurface: "slate-tile",
      poolTile:     "slate-tile",
    },
    materials: {
      exterior: { material: "timber", color: "#2c2824" },
      roof:     { material: "zinc",   color: "#606870" },
      trim:     { material: "timber", color: "#1a1614" },
      decking:  { material: "timber", color: "#a07848" },
    },
  },

  "mid-century": {
    key: "mid-century", label: "Mid-Century Modern", description: "Low-slung shed roof, horizontal siding, clerestory glazing.",
    roofType: "shed",
    defaults: {
      wallFinish:   "horizontal-lap",
      windowStyle:  "casement",
      doorStyle:    "glass-panel",
      railingStyle: "cable",
      columnStyle:  "steel-section",
      patioSurface: "teak-deck",
      poolTile:     "mosaic-tile",
    },
    materials: {
      exterior: { material: "cedar",  color: "#8a6040" },
      roof:     { material: "metal",  color: "#4a4e54" },
      trim:     { material: "metal",  color: "#1e2228" },
      decking:  { material: "timber", color: "#b8904a" },
    },
  },
};
