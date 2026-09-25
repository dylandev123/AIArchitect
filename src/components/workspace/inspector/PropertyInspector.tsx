"use client";

import { useParams } from "next/navigation";
import { MousePointerClick, Trash2 } from "lucide-react";
import { useSceneStore } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { getFeatureRawAt, removeFeatureAt, setFeatureAt } from "@/lib/house/jsonEdit";
import { FEATURE_MODULES, type FeatureRecord } from "@/lib/house/features/registry";
import { FEATURE_FIELDS, type FieldSchema } from "@/lib/house/features/formSchema";
import { FEATURE_LABEL, type FeatureType } from "@/lib/house/features/featureTypes";
import { parseFeatureKey } from "@/lib/house/features/parseFeatureId";
import { BUILDING_KIND_LABELS, LANDSCAPE_KIND_LABELS, ROOM_TYPE_LABELS } from "@/lib/house/constants";
import type { BuildingKind, LandscapeKind, RoofType, RoomType, WallSide } from "@/types/house";

const WALL_OPTIONS: WallSide[] = ["north", "south", "east", "west"];
const ROOM_TYPE_OPTIONS: RoomType[] = ["kitchen", "living", "bedroom", "bathroom", "hallway"];
const BUILDING_KIND_OPTIONS: BuildingKind[] = ["villa", "restaurant", "reception"];
const LANDSCAPE_KIND_OPTIONS: LandscapeKind[] = ["garden", "lawn", "clearing"];
const ROOF_TYPE_OPTIONS: RoofType[] = ["flat", "gable", "hip"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Every select-style field's options, keyed by its FieldSchema type. */
const SELECT_OPTIONS: Partial<Record<FieldSchema["type"], { value: string; label: string }[]>> = {
  wallSelect: WALL_OPTIONS.map((w) => ({ value: w, label: capitalize(w) })),
  roomTypeSelect: ROOM_TYPE_OPTIONS.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] })),
  buildingKindSelect: BUILDING_KIND_OPTIONS.map((k) => ({ value: k, label: BUILDING_KIND_LABELS[k] })),
  landscapeKindSelect: LANDSCAPE_KIND_OPTIONS.map((k) => ({ value: k, label: LANDSCAPE_KIND_LABELS[k] })),
  roofTypeSelect: ROOF_TYPE_OPTIONS.map((r) => ({ value: r, label: capitalize(r) })),
};

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
        <MousePointerClick size={20} className="text-neutral-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-400">Tap anything to edit</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">
          Click walls, windows, rooms, or any object in the scene.
        </p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
      <input
        readOnly
        value={value}
        className="w-full rounded-md border border-white/10 bg-neutral-800/60 px-2.5 py-1.5 text-sm text-neutral-200"
      />
    </div>
  );
}

function ReadOnlyVector3({ label, value }: { label: string; value: [number, number, number] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-neutral-500">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(["X", "Y", "Z"] as const).map((axis, i) => (
          <input
            key={axis}
            readOnly
            value={value[i].toFixed(2)}
            className="w-full rounded-md border border-white/10 bg-neutral-800/60 px-2 py-1.5 text-center text-xs text-neutral-200"
          />
        ))}
      </div>
    </div>
  );
}

function CorePartInspector({ projectId, primitiveId }: { projectId: string; primitiveId: string }) {
  const houseConfigJson = useProjectStore((s) => s.getProject(projectId)?.houseConfigJson ?? "{}");
  const { model } = generateHouseFromJson(houseConfigJson);
  const primitive = model?.primitives.find((p) => p.id === primitiveId);

  if (!primitive) return <EmptyState />;

  return (
    <div className="space-y-5 p-4">
      <ReadOnlyField label="Name" value={primitive.label} />
      <ReadOnlyField label="Type" value={primitive.category} />
      {primitive.kind === "box" && (
        <>
          <ReadOnlyVector3 label="Position" value={primitive.position} />
          <ReadOnlyVector3 label="Size" value={primitive.size} />
        </>
      )}
      <p className="text-xs text-neutral-600">
        Core house geometry is derived from the House JSON tab — edit width, depth, floors, or
        roof there to change it.
      </p>
    </div>
  );
}

function FeatureInspector({
  projectId,
  type,
  index,
}: {
  projectId: string;
  type: FeatureType;
  index: number;
}) {
  const houseConfigJson = useProjectStore((s) => s.getProject(projectId)?.houseConfigJson ?? "{}");
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const selectKey = useSceneStore((s) => s.selectKey);

  const { config: houseConfig } = generateHouseFromJson(houseConfigJson);
  const raw = getFeatureRawAt(houseConfigJson, type, index);
  const { value } = houseConfig ? FEATURE_MODULES[type].validate(raw, houseConfig) : { value: null };

  const handleDelete = () => {
    updateHouseConfig(projectId, removeFeatureAt(houseConfigJson, type, index));
    selectKey(null);
  };

  if (!value) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-neutral-400">
          This {FEATURE_LABEL[type].toLowerCase()}&apos;s data is no longer valid.
        </p>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
        >
          <Trash2 size={13} />
          Remove
        </button>
      </div>
    );
  }

  const handleChange = (key: string, newValue: string | number) => {
    const updated: FeatureRecord = { ...value, [key]: newValue };
    updateHouseConfig(projectId, setFeatureAt(houseConfigJson, type, index, updated));
  };

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100">
          {FEATURE_LABEL[type]} {index + 1}
        </h3>
        <button
          onClick={handleDelete}
          title="Remove"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {FEATURE_FIELDS[type].map((field) => {
        const options = field.type === "select" ? field.options?.map((o) => ({ value: o, label: capitalize(o) })) : SELECT_OPTIONS[field.type];
        const current = value[field.key] ?? field.fallback;
        return (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-neutral-500">{field.label}</label>
            {options ? (
              <select
                value={String(current ?? "")}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full rounded-md border border-white/10 bg-neutral-800/60 px-2.5 py-1.5 text-sm text-neutral-200 outline-none focus:border-amber-500/50"
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                step={field.step ?? 0.1}
                value={Number(current ?? 0)}
                onChange={(e) => handleChange(field.key, e.target.valueAsNumber)}
                className="w-full rounded-md border border-white/10 bg-neutral-800/60 px-2.5 py-1.5 text-sm text-neutral-200 outline-none focus:border-amber-500/50"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PropertyInspector() {
  const params = useParams<{ projectId: string }>();
  const selectedKey = useSceneStore((s) => s.selectedKey);

  if (!selectedKey) return <EmptyState />;

  const featureRef = parseFeatureKey(selectedKey);
  if (featureRef) {
    return <FeatureInspector projectId={params.projectId} type={featureRef.type} index={featureRef.index} />;
  }

  return <CorePartInspector projectId={params.projectId} primitiveId={selectedKey} />;
}
