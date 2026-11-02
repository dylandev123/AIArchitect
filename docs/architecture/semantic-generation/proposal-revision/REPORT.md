# Architectural proposal revision before construction

**A bounded pre-construction revision path is demonstrated offline. The original Terra proposal remains invalid and unchanged. No model-produced architectural revision or complete luxury mansion has been demonstrated.** Three explicitly developer-authored studies construct through the existing semantic compiler and pass its independent sampled surface checks: a coordinated revision of the retained arrangement (92 editable elements), an angled two-level narrow home (43), and the existing horizontal six-suite gallery estate (57).

This continues the [identifier recovery investigation](../live-fresh-2026-10-31/recovery/REPORT.md). Original evidence is preserved against its 15-file SHA-256 manifest. No provider, retrieval, database, credential, production Generate, commit or deployment operation was performed.

## Every retained blocker

[Independent relationship findings](retained-review.json) inspect the unchanged response, including relationships hidden behind the compiler's first failure. They do not bypass acceptance or supply speculative intent. Full construction remains authoritative; diagnostics are not a certificate that every possible conflict has been enumerated.

| Relationship | Recorded intent and software interpretation | Physical possibility and support | Responsibility and required decision |
|---|---|---|---|
| `social-belvedere.relatesTo = ocean-terrace` | The social mass is described as opening to the waterfront terrace. The selected reference names a space, while this field accepts a mass. It is narrative, not a placement constraint. | The intended proximity is possible; the reference is not valid in this model. The description does not identify an alternative mass. | Model-authored wrong-type reference. Select a declared mass, explicitly remove the optional relation, or request a representation change. Software must not guess a mass from the space's ownership. |
| `guest-suite-3` roof / `primary-suite` floor | Lower room: X=12–20, Z=8–16, Y=0–4, roof selected. Owner room above: X=12–24, Z=8–16, floor top 4.2. The compiler emits roof Y=4–4.18 and upper floor Y=4–4.2. | The selected solids intersect. An upper floor acting as the lower room's cover is expressible by explicitly selecting `roof:false` below. Alternatively change the section/footprints and all dependencies. | Model-authored cover conflict; correct rejection. Removing a selected roof is an architectural choice, not mathematical cleanup. |
| Ocean terrace east / guest suite 3 west | X=12: terrace Z=8–14 versus suite Z=8–16. Shared length 6 m, unequal complete edges. | Physically possible partial adjacency, unsupported by the pilot's complete-edge compiler. | Representation limit encountered by model-authored unsupported topology. Align the complete boundaries or escalate for segment support. |
| Ocean terrace west / lower stair court east | X=0: terrace Z=14–8 versus stair court Z=8–16. Another 6 m partial edge. This was hidden behind the first partial-edge rejection. | Also physically possible but unsupported. Correcting only the terrace's east neighbour would not coordinate the west. | Same representation limit. Both sides, adjoining floor outlines, hosts and upper cells require review together. Simply adding collinear polygon vertices violates the existing strict-convex contract. |
| Twelve portal offsets | Every portal selects `offset:0.5`, despite widths 1.2–4.8 m. Offsets are interpreted as metres from the selected host edge's start, not fractions. See the table below. | Every start margin is negative. All could fit at other explicitly chosen positions; those positions are not established by this output. | Authored invalid values under an incompletely explained original unit contract. Repetition suggests fractional midpoints, but that is unverified. Guidance was clarified during recovery. Converting fractions or centring doors automatically would invent design intent. |
| Stair rise / run | A 4.2 m rise, 24 risers, 3.6 m run gives 0.175 m risers and 0.15 m going. Pilot requires at least 0.25 m going. | Riser is supported. These selected treads are not. At unchanged riser count, minimum run is 6 m. The supported straight stair with two 1.5 m landings and wall insets needs 9.18 m; both selected cells are only 8 m deep. | Genuine model-authored design conflict. A longer stair cannot be repaired locally inside these cells. Revise the cells/neighbours or section, or escalate for a different stair arrangement. |
| Stair lower landing | Start Z=9, landing=1.5 places the lower footprint at Z=7.5; selected cells begin Z=8, with a further 0.09 m wall inset. | The landing leaves both stair cells. Existing straight-flight support can express a different arrangement once explicitly designed. | Model placement error. Moving only the stair is insufficient once run is corrected. Select flight, landings, void, both cells, nearby portals and cover as one coordinated group. |

The previous **software defect** was imposing the interior minimum height on uncovered outdoor terraces. Recovery already corrected that applicability rule. Identifier spelling was already handled by unambiguous identity normalization with collision/reference rejection. Neither justifies moving architecture. No further compiler geometry defect was established in this task; full-edge-only topology is a disclosed capability limitation.

| Portal | Width | Edge length | Selected offset | Permitted offset interval |
|---|---:|---:|---:|---:|
| `arrival-to-salon` | 3.2 m | 12 m | 0.5 m | 1.78–10.22 m |
| `salon-to-kitchen` | 2.4 m | 8 m | 0.5 m | 1.38–6.62 m |
| `salon-to-ocean-terrace` | 4.8 m | 12 m | 0.5 m | 2.58–9.42 m |
| `salon-to-guest-wing` | 1.8 m | 8 m | 0.5 m | 1.08–6.92 m |
| `guest-one-to-two` | 1.2 m | 8 m | 0.5 m | 0.78–7.22 m |
| `guest-one-to-three` | 1.2 m | 8 m | 0.5 m | 0.78–7.22 m |
| `kitchen-to-stair-court` | 1.4 m | 8 m | 0.5 m | 0.88–7.12 m |
| `upper-stair-to-gallery` | 1.8 m | 8 m | 0.5 m | 1.08–6.92 m |
| `gallery-to-sky-terrace` | 4.2 m | 12 m | 0.5 m | 2.28–9.72 m |
| `gallery-to-primary` | 1.6 m | 8 m | 0.5 m | 0.98–7.02 m |
| `primary-to-suite-five` | 1.2 m | 8 m | 0.5 m | 0.78–7.22 m |
| `primary-to-suite-six` | 1.2 m | 12 m | 0.5 m | 0.78–11.22 m |

These intervals establish edge-margin feasibility only. A chosen position must also pass threshold, void, routing and actual-surface checks. They are not recommendations to place every door at its midpoint.

## Smallest justified software change

The new experimental [proposalRevision.ts](../../../../src/lib/villa/experimental/semantic-building/proposalRevision.ts) adds review and revision around the existing semantic model; it does not add another geometry language, layout generator, production route or automatic repair loop.

- `reviewProposal` returns affected object IDs, relationship, measured dimensions, constraints, responsibility and supported alternatives for the demonstrated blockers. Independent inspection reports both partial edges and all twelve openings despite the earlier broken reference. The first authoritative construction failure is retained too. If compilation succeeds, existing mesh-based `physicalEvidence` must also pass; a compiler-accepted but obstructed stair route is tested and refused here.
- `proposalRevisionRequest` supplies the original and latest complete proposals, exact brief, dimensional findings, editable IDs, typed dependency neighbourhood, preserved entities/programme/mass roles and explicit request instructions. Geometric neighbours and cover pairs appear in findings; the complete proposal remains available to reason about the whole building. This is a local request packet, not a provider call or a tested provider wire contract.
- `beginProposalRevision` and `submitProposalRevision` preserve the original response, every accepted/rejected submitted response, changed IDs and findings. One submission is one attempt; **maximum two**. A model's explicit `decision-required` escalates immediately. Exhaustion closes the transaction. There is no planner callback, recursion, retry or silent fresh-house generation.
- The scope names existing architectural entities. All unselected entities are locked. Even selected spaces retain IDs, vertex count, programme use, mass membership, level membership and outdoor status; mass roles, thesis, frame, arrival, access obligations and original limitations remain locked. Adding corridors, moving allocations between levels, changing topology or replacing the concept therefore requires an explicit broader redesign. These are preservation boundaries for this narrow revision experiment, not universal architectural restrictions.
- An accepted submission reconstructs the **whole** semantic dependency group atomically. Shared walls, matching door cuts, profiles, level datums, stair treads and voids come from the existing compiler. No partially repaired components enter a scene. An isolated run or roof fix remains rejected. After construction the existing semantic revision transaction updates dependent components and refuses manual-edit conflicts.
- `restoreProposalRevision` replays the bounded history through the same checks, recomputes bindings and retains an independently editable scene through the existing session restore. Tests exercise actual project-store Undo/Redo and local storage. This is an offline domain API; no studio revision UI was added.

`identifiers.ts` gains a diagnostic-only error collector so independent review can continue beyond broken typed references. The default construction path still throws on every such error; diagnostic output is never passed directly to geometry. No existing semantic compiler acceptance rule was relaxed. The new dimension checks explain demonstrated failures; they do not score architecture or replace the authoritative compiler.

## Explicit mock decisions and offline results

The [fixture authoring function](../../../../scripts/semantic-proposal-revision-fixtures.ts) clones the original. It does not edit the original file, original provider response, or historical recovery evidence. All modified architectural decisions are labelled **developer-authored mocks** in [mock-decisions.json](mock-decisions.json) and the replay history. They demonstrate expressibility, not what Terra would have chosen.

For the retained arrangement the mock explicitly selects `arrival-plinth` as the social mass's narrative relation and removes the lower guest-suite-3 roof. It extends the rear band from Z=8–16 to Z=8–18 and coordinates the ocean terrace, both stair cells, upper gallery, owner/family suites and rear terraces. The 6 m straight flight starts at Z=9.6; its landings and void fit both cells. All twelve portals receive explicitly mocked metre-based midpoint positions. Nothing automatically interprets 0.5 as a normalized coordinate.

The chosen mock scope has 23 entities: one mass, nine spaces, twelve portals and one stair. Other entities remain byte-equivalent after schema/identifier normalization. Five mass roles, fourteen allocations, six suite labels, original room uses, level tops, frame, access obligations, concept and limitations remain preserved. **Preserving those promises does not verify six fitted bedroom suites.**

| Offline study | Revision tested | Result |
|---|---|---|
| Retained arrangement, mocked revision | Complete dependent stair/outline/cover/portal decisions above | 92 editable elements; deterministic replay; zero sampled physical failures; exact revision-history/session reload. |
| Independent angled narrow two-level home | Start with a defective 2 m run; explicitly revise only the named straight stair to the existing valid 4.8 m run | 43 editable elements; zero sampled physical failures. Different origin, rotation, angled living cell and compact programme. |
| Existing horizontal gallery estate, additional mock | Correct a deliberately invalid selected portal offset; preserve all other entities | 57 editable elements; zero sampled physical failures. Six private allocations open from a common gallery rather than requiring passage through other suites. |

[Verification](verification.json), [retained history and geometry](mock-retained-history.json), [second history](mock-second-history.json) and [gallery study](mock-gallery-estate-summary.json) retain the actual results. There is no special-case compiler branch for these IDs. Impossible long flights, unsupported/partial fixes, out-of-scope edits, changed programme, identity changes, manual dependent geometry edits and physical obstructions are rejected in tests. Accepted geometry remains editable with normal scene operations; an unrelated roof finish survives a later portal revision, whose wall and door update together.

The original rejected response still fails construction. No developer choice has been relabelled as AI recovery, and no beauty claim is made from compiler acceptance or fewer findings.

## Overall mansion design remains unresolved

The retained concept has a dominant social belvedere, lower guest wing and elevated family/owner pavilion. This is meaningful mass hierarchy and accommodation intent worth preserving through a targeted feasibility revision. However, two guest suites still depend on passage through guest suite 1, and family suites 5 and 6 through the owner suite. The only stair route still passes through the kitchen. A requested covered arrival still has `roof:false`. These are architectural shortcomings even though routes can be physically connected.

The narrow revision intentionally does not silently convert suite area into a common corridor or relabel a bedroom as circulation. A convincing luxury mansion needs a broader, explicit circulation redesign: select shared galleries/vestibules, retain appropriate suite areas and privacy, coordinate the vertical hinge with the main arrival/social sequence, and revise associated portals, mass edges and roofs together. The gallery-estate fixture shows this vocabulary can express independent suite access; it is not a completed replacement mansion. Adding those circulation cells to the retained design needs an approved identity/programme migration outside this checkpoint.

The compiler also lacks partial-edge segmentation, turning stairs, ordinary elevated-sill facade windows, complex/overhanging roofs, shading systems, guards, pools, planting, terrain and finished interiors. The original output contains material labels and terrace reserves, not completed facade depth or landscape composition. No new rendering or visual superiority is asserted. Bounded sampled surface checks assume open doors and do not certify continuous whole-house navigation, engineering, code compliance or a complete premium home.

## Bounded future live experiment

**A separate, explicitly authorized live test of relationship revision is now justified; a production switch or a complete-mansion claim is not.** First use one saved proposal, this dimensional packet and a named revision scope. Request a full revised semantic proposal with the existing response schema and a maximum of two design attempts. Retain exact prompts, raw provider envelopes/text, parsed proposals, findings and diffs externally for each attempt; the local history already retains parsed submissions. Provider transport still needs its ordinary preflight and exact-response recorder; no new transport was implemented here.

After each response, normalize only unambiguous identities; compare concept/programme/scope; run complete construction and physical checks. Feed the next packet only if an attempt remains. Commit one editable scene only after all checks pass. Escalate on unsupported required architecture, scope/programme/topology changes, the model's own broader-redesign request, or two unsuccessful attempts. Do not start a fresh automatic run. Visual review and explicit assessment of accommodation, privacy, arrival hierarchy and exterior composition remain separate requirements before claiming an architectural success.

A live test retaining the original private-suite network would establish only feasibility repair. To pursue the actual ambitious mansion next, explicitly broaden the design brief/scope to circulation and exterior composition, preserve the original concept as reference, and record every changed allocation and relationship. The software must not quietly select that redesign on the model's behalf.

## Reproduction and verification

```sh
npx vite-node --config vitest.config.mts scripts/semantic-proposal-revision-offline.ts
npx vitest run src/lib/villa/experimental/semantic-building --reporter=json --outputFile=docs/architecture/semantic-generation/proposal-revision/tests.json
npx eslint src/lib/villa/experimental/semantic-building/proposalRevision.ts src/lib/villa/experimental/semantic-building/proposalRevision.test.ts src/lib/villa/experimental/semantic-building/identifiers.ts scripts/semantic-proposal-revision-fixtures.ts scripts/semantic-proposal-revision-offline.ts
npx tsc --noEmit --pretty false
```

The runner replaces fetch with a throwing implementation and only reads/writes local evidence. It verifies the original manifest before and after replay. Tests cover diagnosis, deterministic construction, scope locks, dependency consistency, explicit escalation, two-attempt limits, preserved rejection history, save/reload, actual project Undo/Redo, manual geometry preservation, impossible arrangements and physical obstruction rejection. See [tests.json](tests.json).

**35 tests pass** across the four semantic-building test files. Focused ESLint passes. Full typecheck remains blocked by the same archived experiment import/type errors and duplicate property in `sol-planning-comparison-review.ts` reported before this task; [typecheck.txt](typecheck.txt) contains the output. No diagnostic points to this task's files.
