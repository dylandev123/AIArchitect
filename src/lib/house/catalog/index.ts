export type { ResolvedExteriorOptions, WallFinishEntry, SurfaceEntry, WindowStyleEntry, DoorStyleEntry, RailingStyleEntry, ColumnStyleEntry, RoofFormEntry, StylePreset, CladdingDetail } from "./types";

export { WALL_FINISHES } from "./wallFinishes";
export { SURFACES } from "./surfaces";
export { WINDOW_STYLES, DOOR_STYLES } from "./openings";
export { RAILING_STYLES } from "./railings";
export { COLUMN_STYLES } from "./columns";
export { ROOF_FORMS } from "./roofForms";
export { STYLE_PRESETS } from "./styles";
export { composeExteriorOptions } from "./composition";

import type { ColumnStyleKey, DoorStyleKey, RailingStyleKey, StyleKey, SurfaceKey, WallFinishKey, WindowStyleKey, RoofType } from "@/types/house";
import { WALL_FINISHES } from "./wallFinishes";
import { SURFACES } from "./surfaces";
import { WINDOW_STYLES, DOOR_STYLES } from "./openings";
import { RAILING_STYLES } from "./railings";
import { COLUMN_STYLES } from "./columns";
import { ROOF_FORMS } from "./roofForms";
import { STYLE_PRESETS } from "./styles";
import type { WallFinishEntry, SurfaceEntry, WindowStyleEntry, DoorStyleEntry, RailingStyleEntry, ColumnStyleEntry, RoofFormEntry, StylePreset } from "./types";

export const getWallFinish   = (k: WallFinishKey):   WallFinishEntry   => WALL_FINISHES[k];
export const getSurface      = (k: SurfaceKey):       SurfaceEntry      => SURFACES[k];
export const getWindowStyle  = (k: WindowStyleKey):   WindowStyleEntry  => WINDOW_STYLES[k];
export const getDoorStyle    = (k: DoorStyleKey):     DoorStyleEntry    => DOOR_STYLES[k];
export const getRailingStyle = (k: RailingStyleKey):  RailingStyleEntry => RAILING_STYLES[k];
export const getColumnStyle  = (k: ColumnStyleKey):   ColumnStyleEntry  => COLUMN_STYLES[k];
export const getRoofForm     = (k: RoofType):         RoofFormEntry     => ROOF_FORMS[k];
export const getStylePreset  = (k: StyleKey):         StylePreset       => STYLE_PRESETS[k];
