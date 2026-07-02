"use client";

import { useParams } from "next/navigation";
import type { ComponentType } from "react";
import {
  Bath,
  BedDouble,
  Building,
  ChefHat,
  DoorOpen,
  Flower2,
  Footprints,
  Grid2x2,
  Layers,
  ParkingSquare,
  Plus,
  RectangleHorizontal,
  Route,
  Sofa,
  Square,
  UtensilsCrossed,
  Warehouse,
  Waves,
} from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { addFeature, getFeatureCount } from "@/lib/house/jsonEdit";
import {
  getDefaultBuildingConfig,
  getDefaultFeatureConfig,
  getDefaultLandscapeConfig,
  getDefaultRoomConfig,
} from "@/lib/house/features/defaults";
import { FEATURE_LABEL, type FeatureType } from "@/lib/house/features/featureTypes";
import { BUILDING_KIND_LABELS, LANDSCAPE_KIND_LABELS, ROOM_TYPE_LABELS } from "@/lib/house/constants";
import { DEFAULT_HOUSE_CONFIG, type BuildingKind, type LandscapeKind, type RoomType } from "@/types/house";

const PARTS: { type: FeatureType; icon: ComponentType<{ size?: number }> }[] = [
  { type: "window", icon: Square },
  { type: "door", icon: DoorOpen },
  { type: "garage", icon: Warehouse },
  { type: "balcony", icon: RectangleHorizontal },
  { type: "patio", icon: Grid2x2 },
  { type: "pool", icon: Waves },
  { type: "driveway", icon: Route },
];

const ROOM_PARTS: { type: RoomType; icon: ComponentType<{ size?: number }> }[] = [
  { type: "kitchen", icon: ChefHat },
  { type: "living", icon: Sofa },
  { type: "bedroom", icon: BedDouble },
  { type: "bathroom", icon: Bath },
  { type: "hallway", icon: Footprints },
];

const BUILDING_PARTS: { kind: BuildingKind; icon: ComponentType<{ size?: number }> }[] = [
  { kind: "villa", icon: Building },
  { kind: "restaurant", icon: UtensilsCrossed },
  { kind: "reception", icon: Layers },
];

const LANDSCAPE_PARTS: { kind: LandscapeKind; icon: ComponentType<{ size?: number }> }[] = [
  { kind: "garden", icon: Flower2 },
  { kind: "lawn", icon: Grid2x2 },
];

function SectionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-3.5 text-neutral-400 transition-all duration-150 hover:border-amber-500/25 hover:bg-amber-500/8 hover:text-amber-300 active:scale-95"
    >
      <span className="relative">
        <Icon size={18} />
        <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus size={8} strokeWidth={3} className="text-neutral-950" />
        </span>
      </span>
      <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
    </button>
  );
}

export function HousePartsPanel() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson ?? "{}"
  );
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const selectKey = useSceneStore((s) => s.selectKey);

  const house = generateHouseFromJson(houseConfigJson).config ?? DEFAULT_HOUSE_CONFIG;

  const handleAdd = (type: FeatureType) => {
    const defaults = getDefaultFeatureConfig(type, house);
    const newIndex = getFeatureCount(houseConfigJson, type);
    updateHouseConfig(params.projectId, addFeature(houseConfigJson, type, defaults));
    selectKey(`${type}-${newIndex}`);
  };

  const handleAddRoom = (roomType: RoomType) => {
    const existingCount = getFeatureCount(houseConfigJson, "room");
    const defaults = getDefaultRoomConfig(roomType, house, existingCount);
    updateHouseConfig(params.projectId, addFeature(houseConfigJson, "room", defaults));
    selectKey(`room-${existingCount}`);
  };

  const handleAddBuilding = (kind: BuildingKind) => {
    const existingCount = getFeatureCount(houseConfigJson, "building");
    const defaults = getDefaultBuildingConfig(kind, house, existingCount);
    updateHouseConfig(params.projectId, addFeature(houseConfigJson, "building", defaults));
    selectKey(`building-${existingCount}`);
  };

  const handleAddLandscape = (kind: LandscapeKind) => {
    const existingCount = getFeatureCount(houseConfigJson, "landscape");
    const defaults = getDefaultLandscapeConfig(kind, house, existingCount);
    updateHouseConfig(params.projectId, addFeature(houseConfigJson, "landscape", defaults));
    selectKey(`landscape-${existingCount}`);
  };

  return (
    <div className="space-y-5 p-3">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-600">
          🛏 Rooms
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ROOM_PARTS.map(({ type, icon }) => (
            <SectionButton key={type} icon={icon} label={ROOM_TYPE_LABELS[type]} onClick={() => handleAddRoom(type)} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-600">
          🏗 Site Structures
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BUILDING_PARTS.map(({ kind, icon }) => (
            <SectionButton key={kind} icon={icon} label={BUILDING_KIND_LABELS[kind]} onClick={() => handleAddBuilding(kind)} />
          ))}
          <SectionButton icon={Route} label={FEATURE_LABEL["road"]} onClick={() => handleAdd("road")} />
          <SectionButton icon={ParkingSquare} label={FEATURE_LABEL["parking"]} onClick={() => handleAdd("parking")} />
          {LANDSCAPE_PARTS.map(({ kind, icon }) => (
            <SectionButton key={kind} icon={icon} label={LANDSCAPE_KIND_LABELS[kind]} onClick={() => handleAddLandscape(kind)} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-600">
          🏠 House Features
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PARTS.map(({ type, icon }) => (
            <SectionButton key={type} icon={icon} label={FEATURE_LABEL[type]} onClick={() => handleAdd(type)} />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-neutral-700 leading-relaxed px-1">
        Click anything to add it, then tap it in the scene to edit.
      </p>
    </div>
  );
}
