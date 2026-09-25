import { describe, expect, it } from "vitest";
import { ROOM_LIMITS } from "../constants";
import { normalizeRoomLayout, roomInterior, type LayoutRoom } from "../normalizeRooms";

interface TestRoom extends LayoutRoom {
  id: string;
  type: string;
}

const HOUSE = { width: 20, depth: 20, floors: 2 };
const EPS = 1e-6;

const room = (id: string, level: number, x: number, z: number, width: number, depth: number, type = "bedroom"): TestRoom => ({
  id,
  type,
  level,
  x,
  z,
  width,
  depth,
});

const boxesOverlap = (a: LayoutRoom, b: LayoutRoom) =>
  a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.z < b.z + b.depth - EPS && b.z < a.z + a.depth - EPS;

function expectNoOverlaps(rooms: readonly LayoutRoom[]) {
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (rooms[i].level !== rooms[j].level) continue;
      expect(boxesOverlap(rooms[i], rooms[j]), `rooms ${i} and ${j} overlap`).toBe(false);
    }
  }
}

function expectWithinBounds(rooms: readonly LayoutRoom[], house: { width: number; depth: number }) {
  const { usableW, usableD } = roomInterior(house);
  for (const r of rooms) {
    expect(r.width).toBeGreaterThanOrEqual(ROOM_LIMITS.width.min - EPS);
    expect(r.depth).toBeGreaterThanOrEqual(ROOM_LIMITS.depth.min - EPS);
    expect(r.x).toBeGreaterThanOrEqual(-EPS);
    expect(r.z).toBeGreaterThanOrEqual(-EPS);
    expect(r.x + r.width).toBeLessThanOrEqual(usableW + EPS);
    expect(r.z + r.depth).toBeLessThanOrEqual(usableD + EPS);
  }
}

/** Identity (everything but geometry) must survive normalization, in order. */
function expectIdentityPreserved(input: readonly TestRoom[], output: readonly TestRoom[]) {
  expect(output).toHaveLength(input.length);
  input.forEach((r, i) => {
    expect(output[i].id).toBe(r.id);
    expect(output[i].type).toBe(r.type);
    expect(output[i].level).toBe(r.level);
  });
}

describe("normalizeRoomLayout: overlaps", () => {
  it("turns identical stacked rooms into non-overlapping rooms", () => {
    const input = [room("a", 0, 2, 2, 5, 4), room("b", 0, 2, 2, 5, 4, "kitchen"), room("c", 0, 2, 2, 5, 4, "bathroom")];
    const { rooms, errors } = normalizeRoomLayout(input, HOUSE);
    expect(errors).toEqual([]);
    expectNoOverlaps(rooms);
    expectWithinBounds(rooms, HOUSE);
  });

  it("resolves a messy partially-overlapping plan", () => {
    const input = [
      room("living", 0, 0, 0, 8, 6, "living"),
      room("kitchen", 0, 6, 1, 6, 5, "kitchen"),
      room("bed1", 0, 3, 4, 5, 5),
      room("bed2", 0, 7, 3, 5, 5),
      room("bath", 0, 5, 5, 3, 3, "bathroom"),
    ];
    const { rooms, errors, adjusted } = normalizeRoomLayout(input, HOUSE);
    expect(errors).toEqual([]);
    expect(adjusted).toBeGreaterThan(0);
    expectNoOverlaps(rooms);
    expectWithinBounds(rooms, HOUSE);
  });

  it("treats rooms that merely touch along an edge as valid", () => {
    const input = [room("a", 0, 0, 0, 5, 5), room("b", 0, 5, 0, 5, 5), room("c", 0, 0, 5, 10, 5)];
    const { rooms, adjusted } = normalizeRoomLayout(input, HOUSE);
    expect(adjusted).toBe(0);
    expect(rooms).toEqual(input);
  });

  it("only compares rooms on the same level", () => {
    const input = [room("a", 0, 1, 1, 6, 6), room("b", 1, 1, 1, 6, 6)];
    const { rooms, adjusted } = normalizeRoomLayout(input, HOUSE);
    expect(adjusted).toBe(0);
    expect(rooms).toEqual(input);
  });

  it("is idempotent: normalizing a normalized layout changes nothing", () => {
    const input = [room("a", 0, 0, 0, 8, 8), room("b", 0, 2, 2, 8, 8), room("c", 0, 4, 4, 8, 8)];
    const first = normalizeRoomLayout(input, HOUSE);
    const second = normalizeRoomLayout(first.rooms, HOUSE);
    expect(second.adjusted).toBe(0);
    expect(second.rooms).toEqual(first.rooms);
  });

  it("is deterministic", () => {
    const input = [room("a", 0, 0, 0, 8, 8), room("b", 0, 2, 2, 8, 8), room("c", 0, 4, 4, 8, 8)];
    expect(normalizeRoomLayout(input, HOUSE)).toEqual(normalizeRoomLayout(input, HOUSE));
  });
});

describe("normalizeRoomLayout: valid placements", () => {
  it("leaves a valid layout exactly unchanged", () => {
    const input = [
      room("living", 0, 0, 0, 8, 6, "living"),
      room("kitchen", 0, 8, 0, 6, 6, "kitchen"),
      room("bed", 0, 0, 6, 5, 5),
      room("bed-up", 1, 3.25, 2.5, 4.5, 4),
    ];
    const { rooms, errors, adjusted } = normalizeRoomLayout(input, HOUSE);
    expect(errors).toEqual([]);
    expect(adjusted).toBe(0);
    expect(rooms).toEqual(input);
  });

  it("keeps the valid rooms fixed while moving only the overlapping one", () => {
    const a = room("a", 0, 0, 0, 6, 6);
    const b = room("b", 0, 10, 10, 4, 4);
    const c = room("c", 0, 1, 1, 3, 3); // inside a
    const { rooms, adjusted } = normalizeRoomLayout([a, b, c], HOUSE);
    expect(rooms[0]).toEqual(a);
    expect(rooms[1]).toEqual(b);
    expect(rooms[2]).not.toEqual(c);
    expect(adjusted).toBe(1);
  });

  it("does not mutate its input", () => {
    const input = [room("a", 0, 0, 0, 8, 8), room("b", 0, 2, 2, 8, 8)];
    const snapshot = structuredClone(input);
    normalizeRoomLayout(input, HOUSE);
    expect(input).toEqual(snapshot);
  });
});

describe("normalizeRoomLayout: floor bounds", () => {
  it("pulls rooms hanging outside the interior back inside", () => {
    const input = [
      room("neg", 0, -5, -3, 4, 4),
      room("far", 0, 50, 50, 4, 4),
      room("edge", 0, 18, 18, 6, 6),
    ];
    const { rooms, errors } = normalizeRoomLayout(input, HOUSE);
    expect(errors).toEqual([]);
    expectWithinBounds(rooms, HOUSE);
    expectNoOverlaps(rooms);
  });

  it("clamps an oversized room to the interior", () => {
    const small = { width: 6, depth: 6 };
    const { rooms, errors } = normalizeRoomLayout([room("huge", 0, 3, 3, 500, 500)], { ...small, floors: 1 });
    expect(errors).toEqual([]);
    expect(rooms[0]).toMatchObject({ x: 0, z: 0, width: 5.6, depth: 5.6 });
    expectWithinBounds(rooms, small);
  });

  it("raises an undersized room to the renderer minimum", () => {
    const { rooms, errors } = normalizeRoomLayout([room("tiny", 0, 0, 0, 0.1, 0.1), room("tiny2", 0, 0, 0, 0.1, 0.1)], HOUSE);
    expect(errors).toEqual([]);
    expect(rooms[0].width).toBe(ROOM_LIMITS.width.min);
    expect(rooms[0].depth).toBe(ROOM_LIMITS.depth.min);
    expectNoOverlaps(rooms);
    expectWithinBounds(rooms, HOUSE);
  });

  it("respects bounds on every level", () => {
    const input = [room("a", 0, 30, 0, 5, 5), room("b", 1, -9, 40, 5, 5)];
    const { rooms } = normalizeRoomLayout(input, HOUSE);
    expectWithinBounds(rooms, HOUSE);
  });
});

describe("normalizeRoomLayout: crowded layouts", () => {
  const tiny = { width: 6, depth: 6, floors: 1 }; // 5.6 × 5.6 m interior

  it("reports a clear error naming the level, room count and interior size", () => {
    const input = [room("a", 0, 0, 0, 5, 5), room("b", 0, 0, 0, 5, 5), room("c", 0, 0, 0, 5, 5)];
    const { errors } = normalizeRoomLayout(input, tiny);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Level 0");
    expect(errors[0]).toContain("3 rooms");
    expect(errors[0]).toContain("5.6 × 5.6 m");
    expect(errors[0]).toMatch(/fewer or smaller rooms/i);
  });

  it("returns a crowded level's rooms untouched and still returns every room", () => {
    const input = [room("a", 0, 0, 0, 5, 5), room("b", 0, 0, 0, 5, 5), room("c", 0, 0, 0, 5, 5)];
    const { rooms, adjusted } = normalizeRoomLayout(input, tiny);
    expect(rooms).toEqual(input);
    expect(adjusted).toBe(0);
  });

  it("only fails the crowded level; other levels are still laid out", () => {
    const house = { ...tiny, floors: 2 };
    const input = [
      room("a", 0, 0, 0, 5, 5),
      room("b", 0, 0, 0, 5, 5),
      room("c", 0, 0, 0, 5, 5),
      room("up1", 1, 0, 0, 3, 3),
      room("up2", 1, 1, 1, 3, 3),
    ];
    const { rooms, errors } = normalizeRoomLayout(input, house);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Level 0");
    expect(rooms.slice(0, 3)).toEqual(input.slice(0, 3));
    expectNoOverlaps(rooms.slice(3));
    expectWithinBounds(rooms.slice(3), house);
  });

  it("shrinks a room slightly instead of failing when it almost fits", () => {
    // Two 5.6 × 3 m rooms in a 5.6 × 5.6 m interior: the second only fits once shrunk.
    const input = [room("a", 0, 0, 0, 5.6, 3), room("b", 0, 0, 0, 5.6, 3)];
    const { rooms, errors } = normalizeRoomLayout(input, tiny);
    expect(errors).toEqual([]);
    expect(rooms[0]).toEqual(input[0]);
    expect(rooms[1].depth).toBeLessThan(3);
    expectNoOverlaps(rooms);
    expectWithinBounds(rooms, tiny);
  });

  it("returns rooms on nonexistent levels untouched without error", () => {
    const input = [room("ghost", 5, -10, -10, 500, 500), room("neg", -1, 0, 0, 4, 4)];
    const { rooms, errors, adjusted } = normalizeRoomLayout(input, HOUSE);
    expect(errors).toEqual([]);
    expect(adjusted).toBe(0);
    expect(rooms).toEqual(input);
  });
});

describe("normalizeRoomLayout: nothing dropped or reordered", () => {
  const TYPES = ["living", "kitchen", "bedroom", "bathroom", "office", "dining"];

  it("keeps count, order, ids, types and levels, and preserves extra fields", () => {
    const input: (TestRoom & { label: string })[] = Array.from({ length: 10 }, (_, i) => ({
      ...room(`r${i}`, i % 2, 1, 1, 6, 5, TYPES[i % TYPES.length]),
      label: `Room #${i}`,
    }));
    const { rooms } = normalizeRoomLayout(input, HOUSE);
    expectIdentityPreserved(input, rooms);
    rooms.forEach((r, i) => expect((r as typeof input[number]).label).toBe(input[i].label));
    expectNoOverlaps(rooms);
  });

  it("keeps original order even when packing order differs", () => {
    // Given out of spatial order (south-east first), output must still follow input order.
    const input = [room("se", 0, 12, 12, 6, 6), room("nw", 0, 0, 0, 6, 6), room("mid", 0, 6, 6, 6, 6), room("dup", 0, 0, 0, 6, 6)];
    const { rooms } = normalizeRoomLayout(input, HOUSE);
    expect(rooms.map((r) => r.id)).toEqual(["se", "nw", "mid", "dup"]);
    expectNoOverlaps(rooms);
  });

  it("rounds fractional levels but leaves types and ids alone", () => {
    const input = [room("a", 0.2, 0, 0, 4, 4, "office"), room("b", 0.4, 0, 0, 4, 4, "study")];
    const { rooms } = normalizeRoomLayout(input, HOUSE);
    expect(rooms.map((r) => [r.id, r.type, r.level])).toEqual([
      ["a", "office", 0],
      ["b", "study", 0],
    ]);
    expectNoOverlaps(rooms);
  });
});

/** Small seeded PRNG (mulberry32) so a failure is reproducible from the seed in the test name. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("normalizeRoomLayout: randomized stress", () => {
  const TYPES = ["living", "kitchen", "bedroom", "bathroom", "office"];
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

  it("upholds every invariant across 200 seeded random layouts", () => {
    let solved = 0;
    let failed = 0;

    for (const seed of SEEDS) {
      const rand = mulberry32(seed);
      const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
      const house = { width: Math.round(between(8, 24)), depth: Math.round(between(8, 24)), floors: 1 + Math.floor(rand() * 3) };
      const count = 2 + Math.floor(rand() * 9);
      const input = Array.from({ length: count }, (_, i) =>
        room(
          `s${seed}-r${i}`,
          Math.floor(rand() * house.floors),
          between(-3, house.width + 3),
          between(-3, house.depth + 3),
          between(1, 9),
          between(1, 9),
          TYPES[Math.floor(rand() * TYPES.length)]
        )
      );
      const snapshot = structuredClone(input);
      const ctx = `seed ${seed}`;

      const result = normalizeRoomLayout(input, house);

      // Always: nothing dropped, identity preserved, input not mutated.
      expect(input, ctx).toEqual(snapshot);
      expectIdentityPreserved(input, result.rooms);

      const failedLevels = new Set(
        result.errors.map((e) => {
          const match = /^Level (\d+):/.exec(e);
          expect(match, `${ctx}: unparseable error "${e}"`).not.toBeNull();
          return Number(match![1]);
        })
      );

      for (let level = 0; level < house.floors; level++) {
        const inLevel = result.rooms.filter((r) => r.level === level);
        if (failedLevels.has(level)) {
          failed++;
          // A level that cannot be packed is reported, and its rooms are returned as given.
          expect(inLevel, ctx).toEqual(input.filter((r) => r.level === level));
          continue;
        }
        if (inLevel.length > 0) solved++;
        expectNoOverlaps(inLevel);
        expectWithinBounds(inLevel, house);
      }
    }

    // Guard against the test silently exercising only one branch.
    expect(solved).toBeGreaterThan(50);
    expect(failed).toBeGreaterThan(0);
  });
});
