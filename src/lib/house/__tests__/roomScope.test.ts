import { describe, expect, it } from "vitest";
import { buildScopeContext } from "@/lib/ai/context";
import { makeScopeForRoom, partitionOpsForScope, scopeFromHint } from "@/lib/ai/targeting";
import { applyPatch } from "../applyPatch";
import { generateHouseFromJson } from "../generateHouse";

const win = (id: string, wall: string, level: number, offset: number) => ({ id, wall, level, offset, width: 1.2, height: 1.2, sill: 0.9 });

// 14 × 10 house (interior 13.6 × 9.6), two floors. Wall offsets include the 0.2 wall thickness.
const project = (over: Record<string, unknown> = {}) => ({
  house: { width: 14, depth: 10, floors: 2, roof: "gable" },
  rooms: [
    { id: "r-kitchen", type: "kitchen", level: 0, x: 0, z: 0, width: 5, depth: 5 },
    { id: "r-bed-a", type: "bedroom", level: 1, x: 0, z: 0, width: 4, depth: 5 },
    { id: "r-bath-a", type: "bathroom", level: 1, x: 4, z: 0, width: 3, depth: 3 },
    { id: "r-bed-b", type: "bedroom", level: 1, x: 9.6, z: 0, width: 4, depth: 5 },
    { id: "r-office", type: "office", level: 1, x: 5, z: 6, width: 4, depth: 3.6 },
  ],
  windows: [
    win("w-bed-a", "north", 1, 1),
    win("w-bed-a-west", "west", 1, 1.5),
    win("w-bath-a", "north", 1, 5),
    win("w-bed-b", "north", 1, 10.5),
    win("w-kitchen", "north", 0, 1),
  ],
  doors: [{ id: "d-bed-b", wall: "east", level: 1, offset: 1, width: 1, height: 2.1 }],
  balconies: [{ id: "b-bed-b", wall: "east", level: 1, offset: 2, width: 2, depth: 1.5, railingHeight: 1 }],
  ...over,
});

const ROOM_A = 1;
const scopeA = () => makeScopeForRoom(ROOM_A, "Bedroom 1 · Floor 2", "r-bed-a");
const ctxFor = (prompt: string, root = project(), scope = scopeA()) => ({ scope, ctx: buildScopeContext(root, scope, prompt) });
const ids = (set?: ReadonlySet<string>) => [...(set ?? [])].sort();

describe("room-scoped AI edits", () => {
  it("allows the room, its openings and balconies — never a new room, materials or the house", () => {
    const { allowedOps, featureTypes, houseFields, materialZones, exterior, site } = scopeA();
    expect([...allowedOps].sort()).toEqual([
      "addBalcony", "addDoor", "addWindow", "removeBalcony", "removeDoor", "removeRoom", "removeWindow",
      "updateBalcony", "updateDoor", "updateRoom", "updateWindow",
    ]);
    expect(featureTypes).toEqual(["room", "window", "door", "balcony"]);
    expect([houseFields, materialZones, exterior, site]).toEqual([[], [], false, false]);
  });

  it("targets the room and only the openings on its own walls and floor", () => {
    const { ctx } = ctxFor("make this window bigger");
    expect(ids(ctx.targetIds.room)).toEqual(["r-bed-a"]);
    expect(ids(ctx.targetIds.window)).toEqual(["w-bed-a", "w-bed-a-west"]);
    expect(ids(ctx.targetIds.door)).toEqual([]);
    expect(ids(ctx.targetIds.balcony)).toEqual([]);
    for (const other of ["r-kitchen", "r-bath-a", "r-bed-b", "w-bed-b", "w-kitchen", "b-bed-b"]) {
      expect(ctx.userMessage).not.toContain(other);
    }
  });

  it("claims balconies and doors that sit on the focused room's wall", () => {
    const { ctx } = ctxFor("add a balcony", project(), makeScopeForRoom(3, "Bedroom 2", "r-bed-b"));
    expect(ids(ctx.targetIds.balcony)).toEqual(["b-bed-b"]);
    expect(ids(ctx.targetIds.door)).toEqual(["d-bed-b"]);
    expect(ids(ctx.targetIds.window)).toEqual(["w-bed-b"]);
  });

  it("brings in the connected ensuite only when the prompt names it", () => {
    expect(ids(ctxFor("make it larger").ctx.targetIds.room)).toEqual(["r-bed-a"]);
    const { ctx } = ctxFor("add a window to the ensuite");
    expect(ids(ctx.targetIds.room)).toEqual(["r-bath-a", "r-bed-a"]);
    expect(ids(ctx.targetIds.window)).toEqual(["w-bath-a", "w-bed-a", "w-bed-a-west"]);
  });

  it("blocks — without widening — when the ensuite is missing or ambiguous", () => {
    const noBath = project({ rooms: project().rooms.filter((r) => r.id !== "r-bath-a") });
    expect(ctxFor("door to the ensuite", noBath).ctx.blocked).toMatch(/ensuite/);

    const twoBaths = project({
      rooms: [...project().rooms, { id: "r-bath-b", type: "bathroom", level: 1, x: 0, z: 5.2, width: 3, depth: 3 }],
    });
    expect(ctxFor("door to the ensuite", twoBaths).ctx.blocked).toMatch(/more than one/i);
    // A bathroom on another floor or across the house is not "directly connected".
    const far = project({ rooms: project().rooms.map((r) => (r.id === "r-bath-a" ? { ...r, x: 6, z: 6 } : r)) });
    expect(ctxFor("door to the ensuite", far).ctx.blocked).toMatch(/couldn't find/);
  });

  it("blocks closets, which have no room type", () => {
    expect(ctxFor("add a walk-in closet").ctx.blocked).toMatch(/closet/i);
  });

  it("blocks when the pinned room is gone, and never falls back to another room", () => {
    expect(ctxFor("make it larger", project(), makeScopeForRoom(42)).ctx.blocked).toBeDefined();
    expect(ctxFor("make it larger", project(), makeScopeForRoom(ROOM_A, "x", "r-deleted")).ctx.blocked).toBeDefined();
    expect(ctxFor("make it larger", project(), makeScopeForRoom(-1)).ctx.blocked).toBeDefined();
  });

  it("follows the room by id when the array has shifted", () => {
    const shifted = project({ rooms: [{ id: "r-new", type: "gym", level: 0, x: 6, z: 6, width: 3, depth: 3 }, ...project().rooms] });
    const { ctx } = ctxFor("make it larger", shifted);
    expect(ids(ctx.targetIds.room)).toEqual(["r-bed-a"]);
  });

  it("does not target a legacy room's neighbours when it has no id yet", () => {
    const legacy = project({ rooms: project().rooms.map(({ id, ...r }) => (id === "r-bed-a" ? r : { id, ...r })) });
    const { ctx } = ctxFor("make it larger", legacy, makeScopeForRoom(ROOM_A));
    expect(ctx.targetIds.room!.size).toBe(1);
    expect(ids(ctx.targetIds.room)).not.toContain("r-kitchen");
  });

  it("supports the room-local edits: resize the window, add a balcony, edit the ensuite", () => {
    const { scope, ctx } = ctxFor("add a window to the ensuite and a balcony outside this bedroom and make this window bigger");
    const { allowed, rejected } = partitionOpsForScope(
      [
        { op: "updateWindow", id: "w-bed-a", fields: { width: 2, height: 1.6 } },
        { op: "addBalcony", value: { wall: "north", level: 1, offset: 1, width: 2, depth: 1.2, railingHeight: 1 } },
        { op: "addWindow", value: { wall: "north", level: 1, offset: 4.6, width: 1, height: 1, sill: 1 } },
        { op: "updateRoom", id: "r-bath-a", fields: { width: 3.5 } },
        { op: "updateRoom", id: "r-bed-a", fields: { depth: 5.5 } },
      ],
      scope,
      ctx.targetIds,
      ctx.roomGuard
    );
    expect(rejected).toEqual([]);
    expect(allowed).toHaveLength(5);
  });

  it("rejects everything outside the room's frontage", () => {
    const { scope, ctx } = ctxFor("edit");
    const { allowed, rejected } = partitionOpsForScope(
      [
        { op: "updateRoom", id: "r-kitchen", fields: { width: 5 } }, // other room
        { op: "updateRoom", id: "r-bath-a", fields: { width: 5 } }, // ensuite not named
        { op: "addRoom", value: {} }, // no new rooms
        { op: "removeRoom", id: "r-bed-b" },
        { op: "updateWindow", id: "w-bed-b", fields: { width: 2 } }, // another room's window
        { op: "updateWindow", id: "w-kitchen", fields: { width: 2 } }, // another floor
        { op: "updateWindow", id: "w-bed-a", fields: { offset: 10.5 } }, // slid onto another room's wall
        { op: "updateWindow", id: "w-bed-a", fields: { level: 0 } }, // moved to another floor
        { op: "addWindow", value: { wall: "south", level: 1, offset: 1, width: 1, height: 1, sill: 1 } }, // wall it doesn't touch
        { op: "addDoor", value: { wall: "north", level: 0, offset: 1, width: 1, height: 2 } }, // wrong floor
        { op: "addWindow", value: { wall: "north", level: 1, offset: 8, width: 1, height: 1, sill: 1 } }, // outside its span
        { op: "removeBalcony", id: "b-bed-b" },
        { op: "setMaterials", fields: { exterior: { color: "#ffffff" } } }, // no room-local finish exists
        { op: "setExteriorOptions", fields: {} },
        { op: "setHouse", fields: { width: 20 } },
        { op: "addPool", value: {} },
      ],
      scope,
      ctx.targetIds,
      ctx.roomGuard
    );
    expect(allowed).toEqual([]);
    expect(rejected).toHaveLength(16);
  });

  it("only lets the focused room be removed, not a connected ensuite", () => {
    const { scope, ctx } = ctxFor("remove the ensuite");
    const { allowed } = partitionOpsForScope(
      [{ op: "removeRoom", id: "r-bath-a" }, { op: "removeRoom", id: "r-bed-a" }],
      scope,
      ctx.targetIds,
      ctx.roomGuard
    );
    expect(allowed.map((o) => o.id)).toEqual(["r-bed-a"]);
  });

  it("fails closed without a resolved room guard", () => {
    const { scope, ctx } = ctxFor("make it larger");
    const { allowed } = partitionOpsForScope([{ op: "updateRoom", id: "r-bed-a", fields: { width: 5 } }], scope, ctx.targetIds);
    expect(allowed).toEqual([]);
  });

  it("leaves every unrelated part of the project byte-identical", () => {
    const root = project();
    const { scope, ctx } = ctxFor("make this window bigger and add a balcony", root);
    const { allowed } = partitionOpsForScope(
      [
        { op: "updateWindow", id: "w-bed-a", fields: { width: 2 } },
        { op: "addBalcony", value: { wall: "north", level: 1, offset: 1, width: 2, depth: 1.2, railingHeight: 1 } },
        { op: "updateRoom", id: "r-bed-a", fields: { depth: 5.5 } },
      ],
      scope,
      ctx.targetIds,
      ctx.roomGuard
    );
    expect(allowed).toHaveLength(3);
    const { json, errors } = applyPatch(JSON.stringify(ctx.root), allowed);
    expect(errors).toEqual([]);
    const after = JSON.parse(json) as ReturnType<typeof project>;
    const s = JSON.stringify;

    expect(s(after.rooms.filter((r) => r.id !== "r-bed-a"))).toBe(s(root.rooms.filter((r) => r.id !== "r-bed-a")));
    expect(s(after.windows.filter((w) => w.id !== "w-bed-a"))).toBe(s(root.windows.filter((w) => w.id !== "w-bed-a")));
    expect(s(after.doors)).toBe(s(root.doors));
    expect(s(after.balconies.filter((b) => b.id === "b-bed-b"))).toBe(s(root.balconies));
    expect(s(after.house)).toBe(s(root.house));
    // …while the targeted parts did change.
    expect(after.windows.find((w) => w.id === "w-bed-a")?.width).toBe(2);
    expect(after.balconies).toHaveLength(2);
    expect(generateHouseFromJson(json).errors).toEqual([]);
  });

  it("is rebuilt by the server from a hint, never trusting the client's ops", () => {
    const rebuilt = scopeFromHint(
      { kind: "room", allowedOps: ["setHouse"], featureTypes: ["pool"], roomId: "r-bed-a", filter: { indices: [3] } },
      "x"
    );
    expect(rebuilt.kind).toBe("room");
    expect(rebuilt.roomId).toBe("r-bed-a");
    expect(rebuilt.filter?.indices).toEqual([3]);
    expect(rebuilt.allowedOps).not.toContain("setHouse");
    expect(rebuilt.featureTypes).toEqual(["room", "window", "door", "balcony"]);
  });

  it("keeps a malformed room hint in room scope instead of widening to the whole house", () => {
    const rebuilt = scopeFromHint({ kind: "room" }, "redesign the entire house");
    expect(rebuilt.level).toBe("component");
    expect(buildScopeContext(project(), rebuilt, "redesign the entire house").blocked).toBeDefined();
  });
});
