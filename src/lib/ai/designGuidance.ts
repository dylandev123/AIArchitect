import { describeTiers } from "@/lib/house/tiers";
import { describeScales } from "@/lib/house/scale";

/**
 * Prompt sections shared by the initial generation and scoped edits, so both describe the richer geometry, the design
 * tiers and the contextual terrain the same way. Each names ops the renderer really has; nothing here is a template
 * for a whole house — every part is a small feature sized from the design it belongs to.
 */

export const SCALE_GUIDANCE = `═══ PROJECT SCALE ═══

"site.projectScale" says how big the project is — footprint, floors, wings, garage, pool and deck, driveway, grounds and outbuildings. It is separate from designTier (how elaborate): a luxury cottage is small with premium finishes. Pick it from the brief ("small cottage", "family home", "luxury home", "estate", "mansion"); when it is not stated, use "family".
${describeScales()}
"house" is the principal volume of a larger composition. Size it from the scale; the renderer then adds the connected wings, the garage row, the pool and deck, the longer drive, the extra garden zones and the detached buildings the scale calls for, so do not duplicate wings it will add and do not shrink the principal volume to make room. For luxury, estate and mansion scales, design for composed massing rather than one large rectangle: connected volumes at different heights, offsets and set-backs, wings framing a courtyard or terrace, and a roof hierarchy (a dominant roof with lower, differently pitched or flat roofs over the subordinate volumes). Use a single unbroken block at those scales only when the brief clearly asks for minimalism. Scale changes the composition, not just the numbers: larger scales have more floors, several connected wings and much more site, not a bigger box. A mansion must never come out as a suburban house.`;

export const TIER_GUIDANCE = `═══ DESIGN TIER ═══

"site.designTier" says how elaborate the project is. It steers architectural complexity, materials, landscaping and outdoor features — it is not a construction-cost estimate. Pick it from the brief ("starter home", "budget", "luxury", "mansion", "estate"); with no such words use "comfort".
${describeTiers()}
A higher tier means more articulated massing, richer materials and more considered grounds, not simply bigger. A lower tier means fewer, simpler parts.`;

export const GEOMETRY_GUIDANCE = `═══ CURVED, ARCHED AND LAYERED PARTS ═══

These are ordinary features. Each has its own id, so "make the turret taller" is one updateBay on that id and nothing else changes.
- "addBay": form "angled" (three-sided bay window), "round" (half-round bay) or "turret" (a round tower with a conical roof — put it at a corner, offset 0 or wall length − width; it may rise one storey above the house). "levels" is how many storeys it climbs.
- "addArch": an arched opening framed on a wall. Place several side by side, each offset advancing by its width, to make an arcade or loggia.
- "addFoundation": a stepped base around the house (one is enough). "addStairs": entry stairs to a ground-floor door — form "straight", "curved" or "angled" (dog-leg with a landing); rise is the height climbed.
- "addDormer" and "addCrossGable": only on a "gable" or "hip" roof, and only on one of the two long walls (the ones the roof slopes toward). Never add them to flat, shed, butterfly or sawtooth roofs.
- "addCurvedWall": an arc of wall around a centre point (startAngle 0 = east, 90 = south). "addRetainingWall": a wall between two points, optionally bowed with "bend".
- Curves elsewhere: pools take "shape" (rectangle | rounded | oval | kidney), decks take "shape" (rectangle | rounded | oval | arc), and driveways, roads and paths take "bend" (meters of sideways bow).
Use these to give a design a distinctive silhouette, scaled to its designTier: a starter house has none of the ornate ones (arches, turrets, curved walls, cross gables).`;

export const TERRAIN_GUIDANCE = `═══ CONTEXTUAL TERRAIN ═══

Add terrain features only when the brief asks for them or the setting clearly implies them — never as decoration:
- River or stream ("addWaterway"): a river is 5–10 m wide, a stream 1.5–4 m. Run it beside the house on the view side or a flank, its centre line at least 12 m from any building and clear of pools, decks and paths, with end points far enough out (about ±60 m along its run) that it crosses the whole site. Give it a "bend" and some "meander" so it looks natural.
- Rocks ("addRockCluster") for rocky, hillside or riverbank settings; a clearing ("addLandscape" kind "clearing") for an open meadow in a forest; shaped ground ("addSlope": mound, ramp or terraced) for landform; "addRetainingWall" where a hillside is cut for the house.
- Paths ("addPath") link places — front door to road, house to river — with a "bend" of 2–6 m so they curve; surface "gravel", "flagstone", "dirt" or "boardwalk".
A "cabin beside a river" needs the river; a "suburban home" does not.`;
