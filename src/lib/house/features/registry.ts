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
import { validateDeck } from "./decks";
import { validatePorch } from "./porches";
import { validateChimney } from "./chimneys";
import { validateCurvedWall } from "./curvedWalls";
import { validateArch } from "./arches";
import { validateBay } from "./bays";
import { validateFoundation } from "./foundations";
import { validateStairs } from "./stairs";
import { validateCrossGable, validateDormer } from "./roofParts";
import { validateRetainingWall } from "./retainingWalls";
import { validatePath } from "./paths";
import { validateWaterway } from "./waterways";
import { validateRockCluster } from "./rocks";
import { validateSlope } from "./slopes";

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
  deck: { validate: validateDeck as unknown as FeatureModule["validate"] },
  porch: { validate: validatePorch as unknown as FeatureModule["validate"] },
  chimney: { validate: validateChimney as unknown as FeatureModule["validate"] },
  curvedWall: { validate: validateCurvedWall as unknown as FeatureModule["validate"] },
  arch: { validate: validateArch as unknown as FeatureModule["validate"] },
  bay: { validate: validateBay as unknown as FeatureModule["validate"] },
  foundation: { validate: validateFoundation as unknown as FeatureModule["validate"] },
  stairs: { validate: validateStairs as unknown as FeatureModule["validate"] },
  dormer: { validate: validateDormer as unknown as FeatureModule["validate"] },
  crossGable: { validate: validateCrossGable as unknown as FeatureModule["validate"] },
  retainingWall: { validate: validateRetainingWall as unknown as FeatureModule["validate"] },
  path: { validate: validatePath as unknown as FeatureModule["validate"] },
  waterway: { validate: validateWaterway as unknown as FeatureModule["validate"] },
  rockCluster: { validate: validateRockCluster as unknown as FeatureModule["validate"] },
  slope: { validate: validateSlope as unknown as FeatureModule["validate"] },
};
