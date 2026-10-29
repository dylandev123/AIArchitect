# Sol High retained-response offline diagnosis

The failure is a model-authored build/delete loop. There is no hidden mansion to recover. No provider calls were made during this investigation. No production code/defaults, original responses/projects, credentials, commits, migrations or deployments were changed.

Provider: `resp_0760a545697ed918006ae35d0dea9487d2b7b602591d301a9a`, completed, gpt-6.1-sol. Source remains `.data/sol-high-background/comparison-2/terminal.json`. Hashes and reproducible results are in `audit.json`. Audit script: `scripts/sol-offline-diagnosis.ts`. The strict response adapter reparsed exact terminal output and matched the previously normalized output exactly. Network fetch was disabled in the audit.

## 1. Exact count and expansion

667 authored operations = 37 assemble + 629 remove + 1 set-terrain. Every assembly is a four-bay residential wing and expands to 17 ordinary adds: one floor, rear/two side walls, four bay walls, four glazing/entrance panels, four headers and one roof. Formula: 5 + 3×4 = 17. Thus 37×17 + 629 + 1 = **1,259**. Expansion overhead is 37×16 = 592. There are no pool assemblies, primitive adds, moves, replacements or upper-floor operations.

Important correction to the earlier audit: Generate removes terrain operations before execution (`terra.ts`, resolveSceneResult). Actual production staging sees **1,258**, still above 800. Full raw expansion includes terrain at authored index 18 / expanded index 34. Subsequent production expanded indexes are one lower than the raw indexes used in this report.

Both limits apply: runtime/result schemas limit authored operations to 800; `stageSceneOperations` independently caps requested operations at 800 and expanded operations at 800 before executing any. `sceneSchema` separately caps final elements at 400. The failure occurs before construction, atomically. It does not prove that 629 elements existed simultaneously.

See `assembly-table.md` for all 37 exact assembly indexes, IDs, positions and counts; `expanded-indexed.json` for every expanded operation; `identity-trace.md` for all 629 add/remove occurrence pairs. All indexes are zero-based.

## 2. Identity and transaction ordering

Authored op 0 assembles `west-wing`, expanded indexes 0–16. Authored ops 1–17 explicitly delete all its elements. Examples: `west-wing-west` added at expanded 2, removed at authored 1 / expanded 17; `west-wing-roof` added at expanded 16, removed at authored 4 / expanded 20; `west-wing` added at expanded 0, removed at authored 17 / expanded 33. Glazing is removed before its parent bay; the root is removed last.

After terrain op 18, authored op 19 reconstructs `west-wing` at expanded 35–51; authored 20–36 delete it again. This ID reuse is sequential and legal: the previous occurrence is already gone. Subsequent names include `private-wing`, `garden-wing`, `suites`, `bedroom-wing`, etc. The last assembly is `west-bedroom-wing`, authored 649 / expanded 1225–1241, followed by its 17 removals at authored 650–666 / expanded 1242–1258.

Every assembly starts with an empty scene, every cycle returns to empty, and every assembly has identical parameters except its ID. Peak live elements: 17. Live ID collisions: zero. Unknown removal targets: zero. Missing live parents: zero. There is no original geometry: this is Generate with an empty base, and every removal targets a newly created occurrence. The assembler emits adds only. It does not synthesize removals, rename IDs or reorder operations.

Diagnostic replay processed all authored operations in order using the existing staging executor on each operation, retaining each intermediate state and checking identity independently. All schema/attachment checks passed. All 37 intact shell snapshots had zero current relationship findings. Final validated scene: **zero elements**. This instrumentation does not alter or bypass production acceptance; unchanged whole-transaction replay still throws `Expanded assembly operation budget exceeded`.

## 3. Architectural evidence and comparison

The plan says court-led and vertically layered organizations were considered, neither completed. There is no selected realized concept. Its sole programme item is “Luxury waterfront residence,” explicitly unbuilt, with empty floor/enclosure/roof/access ID arrays. Spatial relationships are empty. Decisions are considered/guidance, with no constructed element references. Summary and unsupported disclosures explicitly acknowledge failure. Internal reasoning is not evidence of delivered architecture and was not interpreted as a hidden construction plan.

The only recoverable transient geometry is one repeated **14×20m (280m²) single-storey shell**, at [-15,0.1,1], height 3.4m, four bays, entry bay 3, ivory material, flat roof, 0.4m overhang. Repetition does not create 37 buildings or 10,360m² of accommodation. All occupy exactly the same position and are sequentially deleted. No bedroom partitions, bathrooms, kitchen/service equipment, stairs, upper levels, arrival route, terrace or pool construction exists. Roof hierarchy is one flat shell roof; façades use the normal repeated assembly bays and headers. There is no property-scale layout or public/private/service organization to assess.

Compared with the earlier retained Terra evidence in `docs/architecture/intelligence-comparison/REPORT.md`, this response demonstrates less developed architectural output. The earlier live Terra draft at least contained salon/family/guest/upper-owner shells, pool, terrace, entrance and stair attempts (88 elements, 368m² principal floor plates), though it too had serious roof/access conflicts and was rejected. Earlier A and the original Solana views are retained there. These are historical outputs with context/schema differences, not a controlled model ranking. **There is no evidence Sol delivered or planned a substantially more sophisticated house in this retained response.** Transaction invalidity and architectural ambition are separate judgments; here the operations and plan independently fail to substantiate the ambitious house.

`first-transient-shell.DIAGNOSTIC.json` is an isolated, editable 17-element snapshot copied from the first assembly only, clearly labelled as transient evidence. It is not the final scene, a correction or a recovered house. No developer design choices or response corrections were authored. House arrival/aerial/entrance/poolside screenshots were not produced: there is no intended house or pool geometry to render, and presenting four views of this explicitly deleted shell as recovered architecture would be misleading.

## 4. Justified correction and accounting assessment

No expansion or identity defect was proven; no geometry/schema correction or budget increase is justified for this output. Preserving any shell by dropping removals would contradict the explicit model sequence and its failure disclosure. Combining renamed shells would invent design choices and overlay identical volumes.

The justified application improvement is diagnostic clarity: report authored count, expanded count after Generate filtering, assembly provenance, and final retained construction status. A future nonempty-construction check for Generate should distinguish model-declared incomplete/no-build output from successful construction; it must remain edit-specific so valid removal-only edits remain possible. This is a recommendation, not an untested production change.

A separate bounded assembly budget could be evaluated for genuinely coordinated valid transactions: retain authored-operation cap, bound deterministic assembly expansion/work, retain final 400-element cap plus all dimensions/panels/IDs/attachment/relationship validation and atomic application. Counting assemblies as one without any expansion/work bound would hide resource costs. This sample is not evidence for changing 800: it has only 17 live elements, excessive repetitive churn and no final construction. No alternative accounting was applied and all production defaults remain unchanged.

## 5. Recovery and next spending decision

The exact response is recoverable and reproducibly diagnosable offline. Its individual shell is recoverable as evidence. A complete editable house cannot be recovered faithfully: the authored final state is empty, the programme has no constructed references, and no omitted house operations exist in the completed text. Raising the budget merely permits a valid empty final scene.

Another paid call is unnecessary for diagnosis or recovery of existing evidence. Delivering a complete mansion would require new design work, either explicitly developer-authored or separately authorized generation; this response cannot supply it. No further paid call was made or scheduled.
