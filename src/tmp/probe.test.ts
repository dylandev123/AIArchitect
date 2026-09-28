import { it } from "vitest";
import { assembleVilla } from "@/lib/library/__tests__/villaFixture";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
it("probe", () => {
  for (const opts of [{}, { view: "east" as const, approach: "west" as const }]) {
    const { json } = assembleVilla(opts);
    const { site } = generateHouseFromJson(json);
    const s = site!;
    console.log(JSON.stringify({ house: s.house, settings: s.settings, patios: s.patios, decks: s.decks, pools: s.pools, buildings: s.buildings.map(b=>({k:b.kind,x:b.x,z:b.z,w:b.width,d:b.depth,r:b.rotation})), landscaping: s.landscaping, driveways: s.driveways, garages: s.garages, paths: s.paths, doors: s.doors.filter(d=>d.level===0), porches: s.porches, parking: s.parking, roads: s.roads, stairs: s.stairs }));
  }
});
