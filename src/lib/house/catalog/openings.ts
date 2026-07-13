import type { DoorStyleKey, WindowStyleKey } from "@/types/house";
import type { DoorStyleEntry, WindowStyleEntry } from "./types";

export const WINDOW_STYLES: Record<WindowStyleKey, WindowStyleEntry> = {
  "casement": {
    key: "casement", label: "Casement", description: "Standard side-hung frame — clean, versatile.",
    compatibleStyles: ["modern-minimalist", "craftsman", "colonial", "tropical", "nordic", "mid-century"],
    mullions: 0, archTop: false, louvers: 0, frameScale: 1.0,
  },
  "double-hung": {
    key: "double-hung", label: "Double-Hung", description: "Traditional sash with horizontal centre rail.",
    compatibleStyles: ["colonial", "craftsman", "mid-century"],
    mullions: 1, archTop: false, louvers: 0, frameScale: 1.0,
  },
  "picture": {
    key: "picture", label: "Picture", description: "Large undivided glazing — maximum light, modern feel.",
    compatibleStyles: ["modern-minimalist", "mid-century", "nordic", "industrial"],
    mullions: 0, archTop: false, louvers: 0, frameScale: 0.7,
  },
  "arched": {
    key: "arched", label: "Arched", description: "Round-top arch above a standard opening — Mediterranean and colonial.",
    compatibleStyles: ["mediterranean", "colonial"],
    mullions: 0, archTop: true, louvers: 0, frameScale: 1.0,
  },
  "louvered": {
    key: "louvered", label: "Louvered", description: "Horizontal timber slats for ventilation — tropical vernacular.",
    compatibleStyles: ["tropical", "mid-century"],
    mullions: 0, archTop: false, louvers: 6, frameScale: 1.0,
  },
};

export const DOOR_STYLES: Record<DoorStyleKey, DoorStyleEntry> = {
  "flush": {
    key: "flush", label: "Flush", description: "Smooth face slab — contemporary and minimal.",
    compatibleStyles: ["modern-minimalist", "industrial", "nordic", "mid-century"],
    panels: 0, glassRatio: 0, double: false,
  },
  "paneled": {
    key: "paneled", label: "Paneled", description: "Classic four-panel raised geometry — traditional character.",
    compatibleStyles: ["colonial", "craftsman", "mediterranean"],
    panels: 4, glassRatio: 0, double: false,
  },
  "glass-panel": {
    key: "glass-panel", label: "Glass Panel", description: "Upper glazing over a solid lower panel — light and elegant.",
    compatibleStyles: ["modern-minimalist", "mid-century", "tropical"],
    panels: 0, glassRatio: 0.55, double: false,
  },
  "double": {
    key: "double", label: "Double Door", description: "Two narrower leaves — grand entrance.",
    compatibleStyles: ["mediterranean", "colonial", "craftsman", "tropical"],
    panels: 2, glassRatio: 0, double: true,
  },
  "pivot": {
    key: "pivot", label: "Pivot Door", description: "Off-centre pivot, oversized slab — statement contemporary.",
    compatibleStyles: ["modern-minimalist", "industrial", "mid-century"],
    panels: 0, glassRatio: 0, double: false,
  },
};
