import type { DesignTier, HouseConfig, MaterialsConfig } from "@/types/house";
import type { ResolvedExteriorOptions } from "../catalog/types";
import type { DoorSpan } from "../architecture/parts";
import type { HeightFn } from "../geometry/mesh";

/**
 * What the newer feature builders need beyond their own config: the house they attach to, the resolved look, the
 * project's design tier, and the shape of the ground. Passing one object keeps builder signatures stable as the
 * renderer learns new things about the site.
 */
export interface BuildContext {
  house: HouseConfig;
  materials: MaterialsConfig;
  opts?: ResolvedExteriorOptions;
  tier: DesignTier;
  /** Ground-floor door openings, so foundations and steps can leave them clear. */
  doors: readonly DoorSpan[];
  /** Ground height (m) at a site point; 0 on level land. */
  groundAt: HeightFn;
  /** The ground's base colour, for shaped earth (mounds, ramps) that must blend into it. */
  groundColor: string;
}
