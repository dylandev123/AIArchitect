import { describe, expect, it } from "vitest";
import { generateHouseFromJson } from "../generateHouse";
import { LEVEL_HEIGHT } from "../constants";
import { cutawayHiddenIds, listRooms, resolveRoomFocus, roomCameraGoal } from "../roomView";

const HOUSE = { width: 14, depth: 10, floors: 2, roof: "gable" };

const rooms = [
  { id: "r-kitchen", type: "kitchen", level: 0, x: 0.5, z: 0.5, width: 4, depth: 4 },
  { id: "r-bed-a", type: "bedroom", level: 1, x: 0.5, z: 0.5, width: 4, depth: 4 },
  { type: "office", level: 0, x: 5, z: 0.5, width: 4, depth: 4 }, // legacy: no id yet
  { id: "r-bed-b", type: "bedroom", level: 1, x: 5, z: 0.5, width: 4, depth: 4 },
];

const project = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    house: HOUSE,
    windows: [{ id: "w1", wall: "east", level: 0, offset: 2, width: 1.2, height: 1.2, sill: 0.9 }],
    rooms,
    ...over,
  });

describe("listRooms", () => {
  it("lists rooms by their true array index, with floor and disambiguated names", () => {
    const { rooms: list, floors } = listRooms(project());
    expect(floors).toBe(2);
    expect(list.map((r) => [r.index, r.name, r.floorName])).toEqual([
      [0, "Kitchen", "Ground floor"],
      [1, "Bedroom 1", "Floor 2"],
      [2, "Office", "Ground floor"],
      [3, "Bedroom 2", "Floor 2"],
    ]);
    expect(list[2].id).toBeUndefined();
  });

  it("keeps array indices when an invalid entry is skipped", () => {
    const { rooms: list } = listRooms(project({ rooms: [{ nonsense: true }, rooms[0]] }));
    expect(list.map((r) => r.index)).toEqual([1]);
  });

  it("yields nothing for unusable input", () => {
    expect(listRooms("not json").rooms).toEqual([]);
    expect(listRooms("{}").rooms).toEqual([]);
  });
});

describe("resolveRoomFocus", () => {
  const list = listRooms(project()).rooms;

  it("follows a room by id even after it moves in the array", () => {
    const shuffled = [...list].reverse().map((r, i) => ({ ...r, index: i }));
    expect(resolveRoomFocus(shuffled, { index: 0, id: "r-kitchen" })?.name).toBe("Kitchen");
  });

  it("falls back to the index while a legacy room has no id, and gives up when the room is gone", () => {
    expect(resolveRoomFocus(list, { index: 2 })?.name).toBe("Office");
    expect(resolveRoomFocus(list, { index: 9 })).toBeNull();
    expect(resolveRoomFocus(list, { index: 0, id: "r-deleted" })).toBeNull();
    expect(resolveRoomFocus(list, null)).toBeNull();
  });
});

describe("roomCameraGoal", () => {
  it("starts inside the room, up under its ceiling, looking down into it", () => {
    for (const room of listRooms(project()).rooms) {
      const { position, target } = roomCameraGoal(room);
      const [cx, cz] = room.center;
      expect(Math.abs(position[0] - cx)).toBeLessThan(room.width / 2);
      expect(Math.abs(position[2] - cz)).toBeLessThan(room.depth / 2);
      const floorTop = room.level * LEVEL_HEIGHT;
      expect(position[1]).toBeGreaterThan(floorTop + 2);
      expect(position[1]).toBeLessThan(floorTop + LEVEL_HEIGHT);
      expect(target[1]).toBeLessThan(position[1]);
      expect(Math.hypot(...position.map((v, i) => v - target[i]))).toBeGreaterThanOrEqual(2.49);
    }
  });

  it("stays inside a tiny room", () => {
    const [tiny] = listRooms(project({ rooms: [{ type: "laundry", level: 0, x: 1, z: 1, width: 1.2, depth: 1.2 }] })).rooms;
    const { position } = roomCameraGoal(tiny);
    expect(Math.abs(position[0] - tiny.center[0])).toBeLessThan(tiny.width / 2);
    expect(Math.abs(position[2] - tiny.center[1])).toBeLessThan(tiny.depth / 2);
  });
});

describe("cutawayHiddenIds", () => {
  const { model, config } = generateHouseFromJson(project());
  const prims = model!.primitives;
  const byId = new Map(prims.map((p) => [p.id, p]));
  const hiddenFor = (level: number) => cutawayHiddenIds(prims, config!, level);
  const idsOf = (set: Set<string>, category: string) => [...set].filter((id) => byId.get(id)?.category === category);

  it("hides the roof and everything above the room's floor, keeping the room's own level", () => {
    const hidden = hiddenFor(0);
    const roofs = prims.filter((p) => p.category === "roof").map((p) => p.id);
    expect(roofs.length).toBeGreaterThan(0);
    expect(roofs.every((id) => hidden.has(id))).toBe(true);
    expect(hidden.has("floor-1")).toBe(true);
    expect(prims.filter((p) => p.id.startsWith("wall-1")).every((p) => hidden.has(p.id))).toBe(true);
    expect(hidden.has("floor-0")).toBe(false);
    // Rooms upstairs go with the upper floor; rooms on this one stay.
    expect(hidden.has("room-1-floor")).toBe(true);
    expect(hidden.has("room-0-floor")).toBe(false);
  });

  it("on the top floor hides the roof but keeps the ceiling-less shell below", () => {
    const hidden = hiddenFor(1);
    expect(hidden.has("floor-1")).toBe(false);
    expect(hidden.has("floor-0")).toBe(false);
    expect([...hidden].some((id) => id.startsWith("wall-0"))).toBe(false);
    expect(prims.filter((p) => p.category === "roof").every((p) => hidden.has(p.id))).toBe(true);
  });

  it("hides only the camera-side exterior walls and their openings on the room's level", () => {
    const hidden = hiddenFor(0);
    const halfW = config!.width / 2;
    const level0Walls = prims.filter((p) => p.category === "wall" && p.id.startsWith("wall-0"));
    expect(level0Walls.length).toBeGreaterThan(0);
    const hiddenWalls = level0Walls.filter((p) => hidden.has(p.id));
    expect(hiddenWalls.length).toBeGreaterThan(0);
    expect(hiddenWalls.length).toBeLessThan(level0Walls.length);
    // The east window is mounted on a hidden side; the far (west/north) walls remain to look at.
    expect(idsOf(hidden, "window").length).toBeGreaterThan(0);
    for (const p of level0Walls) {
      if (p.kind === "box" && p.position[0] < -halfW + 0.5) expect(hidden.has(p.id)).toBe(false);
    }
  });

  it("never hides site objects", () => {
    const withSite = generateHouseFromJson(
      project({ buildings: [{ kind: "shed", x: 20, z: 0, width: 4, depth: 4 }], pools: [{ siteX: 0, siteZ: 14, width: 4, length: 6, depth: 1.5 }] })
    );
    const hidden = cutawayHiddenIds(withSite.model!.primitives, withSite.config!, 0);
    for (const p of withSite.model!.primitives) {
      if (["building", "pool"].includes(p.category)) expect(hidden.has(p.id)).toBe(false);
    }
  });
});
