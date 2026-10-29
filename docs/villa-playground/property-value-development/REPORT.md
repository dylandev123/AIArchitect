# Property value guidance and single Terra development experiment

The knowledge extension is implemented. The one live experiment produced a valid, editable, modest functional improvement, **not a substantially stronger overall residential composition**. The candidate and new knowledge remain unapproved.

## Knowledge

The existing authoritative repository-backed library now exposes 310 entries: all 301 prior entries plus nine proposed `property-value` recipes. There is no separate database, migration, new engine or agent. Seeds enter the existing `knowledgeRecords` merge; stored revisions override seeds, preserving the normal provenance, optimistic versioning, bulk import, supersession and approval workflow. No production database records were changed.

Profiles cover $100k–250k, $250k–500k, $500k–1m, $1m–3m, $3m–5m, $5m–10m, $10m–25m, $25m–50m, and $50m–100m+. They address ambition, programme relationships, arrival, suite privacy, materials, roofs, sheltered outdoor living, selective amenities and site context. Price is expressly contextual: location, land, waterfront access, market and construction conditions can dominate it. No floor area, bedroom total, floors, amenity checklist or element minimum follows from a price.

The entries are proposed, with user-brief provenance marked unverified. Their inclusion in live retrieval requires ordinary human approval; this experiment did not self-approve them. Approval tests use in-memory mocks only. This distinction limits the result: live value-profile influence has **not** been demonstrated.

An explicit USD/$ amount selects at most one profile, subject to approval. Boundary values use the higher band; $100m+ stays in the final band. Existing scene-description inference supplies ambition when no amount is present without inventing a valuation. Low-value briefs without an explicit larger-scale description use the compact context. Existing entry/character budgets remain unchanged. The value profile competes alongside complementary composition, programme, style, climate and detailing recipes; it never retrieves all nine bands.

Examples with simulated approval (full traces in [retrieval.json](../../architecture/property-value/retrieval.json)):

| Brief | Value reference | Complementary retrieved guidance |
|---|---|---|
| $100k compact family home | $100k–250k | compact family, compact core order, covered threshold |
| $2m tropical villa | $1m–3m | tropical envelope, compact family relationships, deep overhang |
| $25m tropical waterfront estate with pool | $25m–50m | estate composition, waterfront, tropical envelope, pool construction |
| $25m Mediterranean urban mansion with courtyard | $25m–50m | Mediterranean courtyard, facade materials, deep reveals, loggia depth |
| $100m tropical estate | $50m–100m+ | tropical envelope, estate composition, shade and privacy |
| Luxurious tropical residence, no amount | none | existing qualitative ambition and climate retrieval |

Construction instructions require actual enclosure, supported floors, entrance assemblies, openings, roofs and connected terraces. Existing design-decision IDs and geometry audits remain the evidence path. The offline authored entrance fixture proves profile evidence can travel with editable geometry; it is not proof that a model independently designs better because of the profiles.

## Single paid experiment

Starting scene: `docs/villa-playground/two-stage/retained.after.json`, the latest retained offline two-stage candidate, not a newly generated house. The upstream original and all retained responses remain intact. The baseline SHA-256 is recorded in [preserved.json](preserved.json).

The script uses canonical Terra system instructions, schema, model configuration, knowledge service, reviewed lessons, two-stage request builder and direct-scene executor. An explicit `recompose` option permits massing revision for this experiment while retaining scoped behavior by default. One exclusive attempt marker, SDK `maxRetries: 0` and a transport guard prohibit a second provider request. No image generation or paid visual review occurred.

The initial sandbox run stopped on the knowledge database DNS lookup, before creating an attempt marker or contacting OpenAI. The subsequent permitted network execution made exactly **one** OpenAI request. HTTP 200; finish reason `stop`; no provider error or retry. All response data and settings are retained locally.

Approved live selections were `facade-materials`, `estate-composition`, `roof-main-secondary` and `waterfront-estate`. New proposed value profiles were correctly excluded.

Actual provider usage: **12,681 input + 4,358 output = 17,039 total tokens**, including 2,588 reasoning tokens within output. These are provider totals, not isolated knowledge-token measurements. No unsupported dollar-cost estimate is reported.

Nine operations changed 77 elements to 83:

- Replace the salon's central glazed bay with an actual unglazed doorway and add its bronze door.
- Add the west upper terrace deck; move/resize its existing front guard and add side guards.
- Add two bronze screens to the covered pool-facing terrace.

No changes were synthesized or repaired after the response. The executor accepted the returned operations atomically; before and after have zero scene-relationship issues. Serialization round-trips. The candidate is a separate [after.json](after.json), with `approval: unapproved` in the audit. No design-learning write, commit or deployment occurred.

## Matching offline comparison

Both scenes were rendered at identical camera positions, targets, field of view and canvas size. All browser AI/external requests were intercepted or blocked. Retained operations were replayed as a local fixture; browser checks verified undo and persistence after reload. [Browser evidence](browser-evidence.json) records matching cameras and zero page errors.

| View | Before | After | Assessment |
|---|---|---|---|
| Aerial | [Before](before-aerial.png) | [After](after-aerial.png) | New timber upper terrace and guards are visible; building footprint, main volumes and roof hierarchy remain essentially unchanged. |
| Arrival | [Before](before-arrival.png) | [After](after-arrival.png) | Entrance canopy, portal, facade proportions and composition are effectively unchanged. This priority was not meaningfully developed. |
| Poolside | [Before](before-poolside.png) | [After](after-poolside.png) | Upper terrace is more usable; lateral screens define the covered outdoor room but partially close its sides. The salon door creates a real threshold. |

The revision is genuinely useful in specific access/terrace relationships. It is not merely arbitrary count inflation. However, the major compositional ambition did not advance: no massing, arrival, suite-programme or roof-hierarchy revision occurred. It remains an underdeveloped residence relative to the requested qualitative ambition. **The ambitious live success criterion is not met.** No further generation was attempted.

## Limits and verification

The architectural audit is `incomplete`, not a luxury certificate. It reports missing knowledge dispositions and partial evidence; estate-composition and waterfront citations omit some required primitive kinds. The inherited west upper suite still has no stair/lift from ground level. Room partitions, bathrooms and services are not proven; shoreline/survey/flood conditions, engineering, waterproofing, drainage, code and pool hydraulics remain unresolved. A valid scene and named luxury spaces do not establish a complete estate or actual market value.

Validation: 66 tests across 16 files pass, covering the property profiles, all prior architectural knowledge tests, canonical scene construction, support relationships, planning and normal project edit/undo/redo/persistence. TypeScript passes. Offline browser undo, saved-scene reload and three matched views pass. No arbitrary architectural restrictions or engine changes were introduced.

Reviewable recipe export: [proposed-recipes.json](../../architecture/property-value/proposed-recipes.json). Offline construction fixture: [mock-construction.json](../../architecture/property-value/mock-construction.json). The remaining approval decisions belong to the user; no approval was inferred from completion of this experiment.
