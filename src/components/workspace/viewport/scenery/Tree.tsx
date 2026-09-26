"use client";

import { useMemo } from "react";
import type { SiteEnvironment } from "@/types/house";
import type { ShrubPlacement, TreePlacement } from "@/lib/landscaping/trees";
import { hashSeed } from "@/lib/landscaping/rng";
import type { VegetationKind } from "@/lib/landscaping/vegetationGeometry";
import { foliageTint, Vegetation } from "./vegetation";

/** Species mix per environment: [kind, weight]. */
const SPECIES: Record<SiteEnvironment | "default", [VegetationKind, number][]> = {
  forest: [["pine", 6], ["oak", 3], ["oak-tall", 1]],
  hillside: [["pine", 4], ["oak", 4], ["oak-tall", 2]],
  countryside: [["oak", 6], ["oak-tall", 3], ["cypress", 1]],
  farm: [["oak", 6], ["oak-tall", 4]],
  beach: [["palm", 8], ["oak-tall", 2]],
  cliff: [["pine", 5], ["cypress", 3], ["oak", 2]],
  suburban: [["oak", 6], ["oak-tall", 3], ["cypress", 1]],
  urban: [["oak-tall", 5], ["cypress", 4], ["oak", 1]],
  default: [["oak", 6], ["oak-tall", 3], ["cypress", 1]],
};

/** Height multiplier over a tree placement's trunk + crown, per species (pines and palms stand taller than oaks). */
const HEIGHT_FACTOR: Record<VegetationKind, number> = { oak: 1.0, "oak-tall": 1.1, pine: 1.3, cypress: 1.2, palm: 1.0, shrub: 1, "shrub-flowering": 1 };

export function pickSpecies(env: SiteEnvironment | undefined, id: string): { kind: VegetationKind; variant: number } {
  const table = SPECIES[env ?? "default"];
  const seed = hashSeed(id, env ?? "default");
  let roll = (seed % 1000) / 1000 * table.reduce((sum, [, w]) => sum + w, 0);
  let kind = table[0][0];
  for (const [k, w] of table) {
    kind = k;
    if ((roll -= w) < 0) break;
  }
  return { kind, variant: (seed >>> 10) % 5 };
}

/**
 * A tree: species chosen from the site's environment, GLB with procedural fallback (see vegetation.tsx), plus a soft
 * grounding shadow so the trunk sits in the lawn rather than floating on it.
 */
export function Tree({ tree, environment }: { tree: TreePlacement; environment?: SiteEnvironment }) {
  const [x, z] = tree.position;
  const { kind, variant } = useMemo(() => pickSpecies(environment, tree.id), [environment, tree.id]);
  const tint = useMemo(() => foliageTint(tree.foliageColor), [tree.foliageColor]);
  const height = (tree.trunkHeight + tree.foliageRadius * 2.1) * HEIGHT_FACTOR[kind];
  const shadowRadius = tree.foliageRadius * (kind === "cypress" ? 0.7 : 1.05);

  return (
    <group position={[x, tree.y ?? 0, z]} rotation={[0, tree.rotationY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[shadowRadius, 24]} />
        <meshBasicMaterial color="#0a1408" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <Vegetation kind={kind} variant={variant} height={height} tint={tint} />
    </group>
  );
}

export function Shrub({ shrub }: { shrub: ShrubPlacement }) {
  const tint = useMemo(() => foliageTint(shrub.color), [shrub.color]);
  return (
    <group position={[shrub.position[0], shrub.y ?? 0, shrub.position[1]]} rotation={[0, shrub.rotationY, 0]}>
      <Vegetation kind={shrub.flowering ? "shrub-flowering" : "shrub"} variant={shrub.variant} height={shrub.height} tint={tint} />
    </group>
  );
}
