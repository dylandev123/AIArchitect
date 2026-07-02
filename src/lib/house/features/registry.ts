import type { HouseConfig } from "@/types/house";
import type { FeatureType } from "./featureTypes";
import type { FeatureValidation } from "./validateHelpers";
import { validateWindow } from "./windows";
import { validateDoor } from "./doors";
import { validateGarage } from "./garages";
import { validateBalcony } from "./balconies";
import { validatePatio } from "./patios";
import { validatePool } from "./pools";
import { validateDriveway } from "./driveways";
import { validateRoom } from "./rooms";
import { validateBuilding } from "./buildings";
import { validateRoad } from "./roads";
import { validateParking } from "./parking";
import { validateLandscapeZone } from "./landscapeZones";

export type FeatureRecord = Record<string, unknown>;

interface FeatureModule {
  validate: (raw: unknown, house: HouseConfig) => FeatureValidation<FeatureRecord>;
}

/**
 * Dynamic, type-erased view over each feature's validator, used by the Property
 * Inspector to re-validate the currently-selected item and populate its form.
 * The underlying modules stay fully typed; this registry exists only to let one
 * UI component handle every feature shape without a bespoke form per type. The
 * `as unknown as` casts are an intentional, contained erasure boundary at that seam.
 */
export const FEATURE_MODULES: Record<FeatureType, FeatureModule> = {
  window: { validate: validateWindow as unknown as FeatureModule["validate"] },
  door: { validate: validateDoor as unknown as FeatureModule["validate"] },
  garage: { validate: validateGarage as unknown as FeatureModule["validate"] },
  balcony: { validate: validateBalcony as unknown as FeatureModule["validate"] },
  patio: { validate: validatePatio as unknown as FeatureModule["validate"] },
  pool: { validate: validatePool as unknown as FeatureModule["validate"] },
  driveway: { validate: validateDriveway as unknown as FeatureModule["validate"] },
  room: { validate: validateRoom as unknown as FeatureModule["validate"] },
  building: { validate: validateBuilding as unknown as FeatureModule["validate"] },
  road: { validate: validateRoad as unknown as FeatureModule["validate"] },
  parking: { validate: validateParking as unknown as FeatureModule["validate"] },
  landscape: { validate: validateLandscapeZone as unknown as FeatureModule["validate"] },
};
