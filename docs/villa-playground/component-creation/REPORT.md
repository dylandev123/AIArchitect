# Terra architectural component creation V1

The development workshop at `/dev/villa-playground/create-component` constructs a new architectural form from a deterministic Terra-style proposal. This is bounded parametric invention, not unrestricted autonomous architecture creation. No live Terra invention or paid OpenAI request was tested.

## Creation boundary and scope

The existing `terraComponents()` registry advertises approved version-pinned builders. Terra's villa route authors configuration and atomic patches; `buildComposition()` validates and projects that configuration into existing React Three Fiber builders. Elliptical pavilions already use bounded extrusion and `PrimitiveMesh`; footprint buildings already support curved outlines, articulated facades and an inset upper storey. Landscape paths already use sampled ribbons. None of those builders could author a raised, banking, variable-width solid canopy.

This extension adds only `swept-ribbon@1`, a controlled geometry grammar. It reuses `PrimitiveMesh`, villa PBR finishes, `Box` support posts, `VillaScene`, composition envelope validation, landscape bounds and the visual-review PNG capture checks. No modeling service, executable model-generated code, agent, provider, migration or V3 change was introduced. The existing approved component registry and paid villa generation contract remain untouched.

The Playground's development presets link to **Create Architectural Component**. An authored Playground composition and retained brief can be brought into the workshop with **Load current Playground composition**. Two offline villa fixtures are also available. This workshop uses a separate experimental composition wrapper rather than extending the production saved-design schema.

## New forms and construction

- **Tidal Ribbon:** a 9 m long pale canopy with alternating lateral sweeps, changing width, rising crests and banked edges, on four slender posts. Nominal width 3 m, base soffit 3.4 m, thickness 0.18 m.
- **Flared Sail:** the same builder produces a visibly different tapered bronze canopy, widening and rising toward one end. It has an actual metal PBR surface; the pale ribbon uses render and limestone is also supported.

A proposal records intent, character, details, compatibility, attachment mode, reused builders and validated geometry parameters. Four longitudinal stations control lateral offset, rise, width multiplier and bank. Smoothstep interpolation creates a single-valued surface along X; local code closes its top, bottom, ends and sides. The canopy has 2,624 triangles; four box posts bring the total to **2,672**. Longitudinal ordering prevents branches and self-crossing surfaces. Geometry is finite, closed and consistently wound; no JavaScript from the model is evaluated.

Dimensions are in metres, +Y is up, local length follows X, and placement uses a positive Three.js Y rotation. Existing floor elevation is 0.47 m. Length is 4–14 m; nominal width 1.5–5 m; base soffit height 3–6 m; thickness 0.12–0.4 m. Station width multipliers are 0.5–1.5, offsets ±2 m, rises 0–3 m and bank ±18°. A conservative bound enforces at least 2.6 m roof clearance throughout interpolation. Total height and actual width vary with the station parameters.

The UI supports numeric dimensions, complete proposal JSON editing (including station controls/material), world position/yaw, whole-villa preview and a close inspection camera. Invalid proposal edits preserve the last valid form. Placement errors explain the required clearance and prevent capture/storage. A conservative rotated roof/post envelope must remain within the garden and clear building eaves/verandas, footprint forms, pavilions, pools, courtyards and landscape circulation/planting by 0.3 m. Ordinary terrace paving is allowed beneath the posts. Conservative envelopes can reject geometrically feasible close placements.

## Preview evidence and reuse

The same Tidal Ribbon is constructed in:

| Composition | Position (x, y, z), metres | Yaw |
| --- | --- | --- |
| Horizon House | (14, 0.47, 6) | 0° |
| Breeze Pair | (15, 0.47, 8) | 25° |

Actual browser images:

- [Horizon House, captured scene](tidal-horizon-scene.png) and [workshop](tidal-horizon.png).
- [Breeze Pair, captured scene](tidal-breeze-scene.png) and [workshop](tidal-breeze.png).
- [Tidal Ribbon detail](tidal-detail.png) and [Flared Sail detail](flared-detail.png).
- [Approved pinned reuse](approved-pinned-reuse.png).
- [Unsupported proposal preserves preview](unsupported-preserves-preview.png).
- [Villa Solana regression](regression-solana.png) and [Palmhaven estate regression](regression-estate.png).

The capture path retains the existing blank-image, architecture-framing, context and PNG checks. Responsive previews are resized to the existing 640 × 360 evidence format. Capturing again resets the capture component while preserving the WebGL canvas. Evidence is invalidated when its form, composition, placement or framing changes; editing the proposal clears both retained villa reviews. Geometry/placement validation is repeated before saving and loading.

Browser automation exercised review checkboxes and approval as workflow tests. This is not an independent human architectural, structural or construction approval. Visual inspection confirms visibly different canopy forms and reuse beside two different houses; structural feasibility and architectural quality remain judgments for a designer.

## Candidate storage and approval

Candidates are local JSON records in the already-ignored `.data/villa-component-candidates/<id>@<version>.json`. Each contains identity/version, original intent, full validated proposal and builder reference, customization capabilities, material and attachment rules, two reviewed PNG previews with exact villa/placement snapshots, timestamp, status and explicit `development-only` availability.

Saving always creates an experimental version. Approval requires an exact existing experimental record and writes a new immutable approved version; it never overwrites the source. Exclusive file creation prevents concurrent overwrites. Approval enables local reuse without another proposal call. It does **not** register the candidate with `terraComponents()` or expose it to paid generations.

[The exported pinned villa study](pinned-villa-study.json) embeds its exact candidate version, parameters, villa configuration, placement and preview evidence. Reloading it works without Terra or a latest-version lookup. Existing saved designs keep their current schemas and references. This is local development persistence, not a shared database or production library rollout.

## Verification

- **156/156 focused tests pass:** all villa library suites, Playground geometry/model suites, visual-review route and new creation route. [Machine-readable results](tests.json).
- New geometry tests check distinct forms, finite coordinates, triangle budget, two-manifold edges, positive signed volume, dimensions, station edits, clearance and rotated bounds.
- New lifecycle tests check immutable versions, tampered approval rejection, two-composition evidence, pinned reuse and exclusion from paid Terra capabilities.
- New API tests use a mocked provider exclusively. They verify production exclusion, same-origin authorization, required prior offline storage, one-call/no-retry behavior and explicit unsupported-capability output.
- TypeScript check and ESLint on new modules and the changed review-preview module pass.
- [Browser checks](browser-checks.json): no page errors, no AI requests; actual canopy meshes in both compositions; save/approve/reload/export/import; numeric parameter editing; rejection without replacing valid geometry; the second form; finite Solana and Palmhaven scenes with no invented component injected.
- Browser frame timing uses 30 requestAnimationFrame samples per villa, approximately 16–17 ms average on this machine. This is a short local observation, not a cross-device benchmark. Existing postprocessing makes global last-pass renderer counts unsuitable for total-scene triangle claims; component triangles are counted from its actual meshes.

A broader run including the existing `/api/ai/villa` tests found four failures in untouched pre-existing tests: one expects a 6,000-token budget while the existing route uses 12,000; three expect older orientation diagnostic paths while the current composition validator reports `wings.main.orientation`. Those failures were left unchanged to preserve the user's existing work. The focused geometry, Solana, estate and creation suites pass; the full broader API suite is not green.

## Live Terra boundary and remaining gaps

The development-only live endpoint uses the existing `getAiModel()`, model selection, provider options, usage logging and pricing utilities. It supplies the architectural brief, requested element, current selected villa and approved registry capabilities, plus the new creation grammar. It permits one paid proposal only after the user explicitly checks the authorization box, clicks the live action and has saved two-villa offline evidence. Authorization resets after each attempt; SDK retries are disabled. Unsupported briefs can return a specific `capabilityGap`; locally invalid geometry is rejected instead of simplified. The browser evidence script blocks all `/api/ai/` requests.

**No paid call was made. No API key was created, rotated, exposed or modified.** Live model output quality and account/model availability remain untested.

Unsupported V1 capabilities include enclosed/glazed new rooms, wall/roof attachment, branches, holes, intersecting ribbons, arbitrary surfaces or meshes, structural calculations, foundations, drainage and fabrication certification. The canopy is freestanding only. Material/detail prose cannot create unsupported geometry. Approval remains local development review; production rollout requires separate work and authorization. No commits or deployment were performed.
