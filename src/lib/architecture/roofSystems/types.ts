import type { HousePrimitive } from "@/lib/house/types";
import type { Paint } from "@/lib/house/architecture/parts";
import type { MaterialAssignment, MaterialType } from "@/types/house";

export type V3 = [number, number, number];

/** How a roof sheds water, which is what decides the systems able to cover it: a near-level deck or pitched planes. */
export type RoofForm = "flat" | "pitched";
export interface RoofShape { form: RoofForm; pitchDeg: number }

/**
 * One planar face of a compiled roof, in local (unrotated) mass space, with the frame a finish is laid out in:
 * `a` runs along the low edge water drains to (an eave, or a butterfly's valley) and `s` straight up the slope
 * from it. Seams follow `s`; courses follow `a`.
 */
export interface RoofPlane {
  id: string;
  origin: V3;
  /** Unit vector along the low edge. */
  along: V3;
  /** Unit vector up the slope, in the plane. */
  up: V3;
  /** Unit normal on the weather side. */
  normal: V3;
  /** The face in plane coordinates, [a, s] per corner. */
  outline: readonly (readonly [number, number])[];
  /** Triangle soup that realizes the face. Empty for a deck whose plate is already built as boxes. */
  vertices: number[];
}

export type RoofEdgeKind = "eave" | "high-eave" | "rake" | "ridge" | "hip" | "valley" | "perimeter";

export interface RoofEdge {
  kind: RoofEdgeKind;
  a: V3;
  b: V3;
  /** Horizontal unit vector [x, z] pointing away from the roof — outer edges only. */
  out?: readonly [number, number];
  /** The planes meeting along a ridge, hip or valley. */
  planes?: readonly RoofPlane[];
}

/** What the geometry builders hand a Roof System to finish: faces and edges, plus parts already built. */
export interface RoofAssembly {
  /** Primitive id prefix, `architecture-<massId>-roof`. */
  id: string;
  shape: RoofShape;
  planes: readonly RoofPlane[];
  edges: readonly RoofEdge[];
  /** Parts that are not the weather surface itself: plates, soffits, reveals, parapets, wall infill. */
  structure: readonly HousePrimitive[];
  /** True when the faces have their own thickness (a shed's slab), so an outer edge takes a rim flashing rather than a board hung under it. */
  slab?: boolean;
  /** Present when a parapet rings the deck: its top and wall thickness, for the coping. */
  parapet?: { topY: number; thickness: number };
}

/** The finish a system resolved for one house: the roof zone's own assignment when it belongs to the system, else the system's default. */
export interface RoofFinish {
  material: MaterialType;
  paint: Paint;
  /** Sheet-metal trim: caps, copings, drip edges. */
  flashing: Paint;
}

export interface RoofFinishContext {
  finish: RoofFinish;
  /** The house's trim zone, for timber fascias and barge boards. */
  trim: Paint;
}

/**
 * A roof covering as one coordinated assembly — finish, surface pattern and edge trim. A house has one primary
 * system (see `planRoofSystems`); the geometry stays the compiler's.
 */
export interface RoofSystem {
  id: string;
  label: string;
  /** Roof-zone materials this system is the covering for. */
  materials: readonly MaterialType[];
  /** The finish used when the roof zone's material belongs to another system. */
  defaultFinish: MaterialAssignment;
  /** The form this system is the natural stand-in for when the primary system can't cover a roof. */
  fallbackFor?: RoofForm;
  supports(shape: RoofShape): boolean;
  /** The compiler's finishing hook: every primitive of the finished roof, in local mass space. */
  finish(assembly: RoofAssembly, ctx: RoofFinishContext): HousePrimitive[];
}
