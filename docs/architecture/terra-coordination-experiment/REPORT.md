# Terra architectural revision experiment — 29 October 2026

**Result: failed the requested architectural success criterion.** Terra described a plausible correction, but supplied only a roof deletion. The collision disappears by subtraction while the replacement shelter and circulation remain unbuilt. This is one observed response, not a general conclusion about Terra's abilities.

## Controlled input and authorization

One paid architectural-revision request used the existing OPENAI_API_KEY and configured model `gpt-5.6-terra`, with SDK retries disabled and a transport guard allowing exactly one request. The exclusive `live-attempt.json` prevents rerunning this experiment. An offline SDK preflight made zero provider calls. The provider returned HTTP 200, status `completed`, finish reason `stop`, and no incomplete details. No second model call, migration, commit, deployment, approval, database write or knowledge/lesson write was made.

The source is `.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.json`. Its original bytes remain unchanged; SHA-256 `247e3e319d10162d2ee1c80a8b6e4b1f843a01840444a220ee6d23731c46eb74`. Its 33 original operations were expanded offline to the exact 88-element Water Court Promenade Estate with its original programme. No developer geometric correction was supplied.

Although `input.prompt` is redacted in the source, `knowledge.query` retains the original brief in full:

> Design an extraordinary $25m contemporary tropical waterfront mansion in Saint Lucia, on a flat site. Create a sophisticated luxury residence with a distinctive entrance, beautiful living spaces, private bedroom wings, purposeful upper-level architecture where appropriate, and integrated outdoor living. Choose a coherent architectural concept using relevant knowledge and construction capabilities. The result should feel like a remarkable luxury estate, not a basic bungalow. Construct fully editable direct-scene architecture.

The request included that brief, the complete editable scene/programme, all coordination findings, exact transformed coordinates and roof conflict bounds, retained relevant architectural knowledge, and the current construction capabilities/system instructions. `messages.json`, `system.json`, `coordination-evidence.json`, and the offline actual SDK wire in `preflight.json` preserve the inputs. The prompt asked Terra to choose its own geometric solution. Existing canonical construction instructions were used unchanged; these already discuss roof/level coordination and manual circulation construction.

## Eight requested evaluations

1. **Selected solution:** In its explicit plan Terra selected “Water Court Promenade—Flanking Roof Edition”: two lower salon roof fields clear of the owner-suite footprint, a narrowed family-pavilion roof, and an exterior east stair with eighteen modeled 0.206 m rises, landing, supported walkway, bridge and new suite door. It described removing the old obstructed central stair and landing/support.
2. **Explicit reasons:** `volumeHierarchy` says it considered a central roof opening/internal stair versus exterior east ascent and flanking roof fields. It selected the latter to preserve the salon's primary low datum, express the suite as an independent lantern above a roof void, and keep subsidiary elements subordinate. `arrivalAndCirculation` explicitly says the exterior stair avoids cutting the salon's occupied slab and roof. These are Terra's stated reasons; they do not establish constructed results.
3. **Actual operations:** Exactly `{"op":"remove","id":"salon-roof"}`. The candidate has 87 elements: zero additions, zero modifications to surviving elements, and one deletion. No flanking roofs, narrowed wing roof, replacement stair, bridge, posts, opening or door were implemented. `response.json` retains the full structured output and `operations.json` the actual operation list.
4. **Roof conflict:** The confirmed `roof-occupied-volume` findings fall from two to zero because the offending roof is removed. Those two findings cover the same lower roof against the suite and stair/landing allocation. This is a real removal of that solid collision, but an incomplete architectural correction: the salon side areas are left uncovered. The existing family-wing roof/occupied-salon review finding remains.
5. **Stair and circulation:** No stair geometry changes. All nine 0.370 m adjacent-rise findings remain, as does `vertical-route-missing` for the upper floor. `stair-landing-overlap` remains. Headroom findings fall from nine to four solely because five probes no longer encounter the deleted roof. Remaining blockers include salon facade bays, the solid landing support and the landing. A usable upper route is still not evidenced.
6. **Visual coherence:** Matched aerial and exterior views retain the ivory/limestone/bronze palette, pavilion wings, water court and elevated suite, but show the former continuous horizontal roof replaced by exposed salon edges/open side bays. The intended flanking-roof composition is absent. My visual assessment is that this reads as unfinished construction and does not maintain a convincing completed mansion. It remains a rendered inspection candidate only.
7. **New conflicts/inconsistencies:** No new solid-overlap conflict is detected; removal cannot itself add a solid. It does remove required salon shelter and breaks the relationship between programme and built geometry. The new plan references nonexistent `salon-roof-west`, `salon-roof-east`, `owner-stair-*` parts and `upper-east-door`, and retains a malformed concatenated tread ID. Spatial-intent mismatch findings increase from one to seven. Total audit findings increase from 76 to 81, though these include disclosed limitations and evidence warnings as well as defects. The response's own `unsupported` states that the candidate has malformed/incomplete programme descriptions and escaped quotes and cannot be accepted. The outer response is actually parseable JSON and schema-valid; that disclaimer does not make the missing construction exist.
8. **Actual usage:** 29,867 input tokens; 5,785 output tokens, comprising 2,888 text and 2,897 reasoning tokens; **35,652 total**. Provider raw usage reports 29,864 cache-write input tokens and zero cached input tokens. These are measured usage, not a billing estimate. Full raw provider response and SDK usage are retained.

## Validation and preservation

Seven focused tests passed across `coordination.test.ts` and `programmeCoordination.test.ts`. The offline SDK preflight passed. Targeted ESLint passed for all experiment and preview scripts. The runtime resolver accepted the one-remove transaction, which means its structural/relationship gate passed; it does not mean this experiment succeeded. No application repair was applied after the response. `before.json` preserves the original expanded scene; `after.UNAPPROVED.json` is the separate candidate; `preserved-versions.UNAPPROVED.json` carries both versions with explicit unapproved status. `evaluation.json` and `audit.json` retain measured comparisons.

Sixteen 1800×1200 screenshots cover eight matched cameras: arrival, aerial, entrance, poolside, interior, upper suite, pool detail and loggia. `browser-result.json` asserts identical before/after camera positions, targets and FOV; complete element ID inventories (88 before, 87 after); finite mesh geometry; and no browser errors. All API/external requests were blocked during capture, with zero provider requests. These use the existing `VillaScene`, `OperationScene` and `SceneTerrain` renderer through a small isolated Vite preview after the existing Next workspace stayed at its loading screen. They are scene-renderer evidence rather than proof of the workspace approval flow. Animated water may differ between frames.

| View | Original | Unapproved candidate |
|---|---|---|
| Aerial | [Before](before-aerial.png) | [After](after-aerial.png) |
| Arrival | [Before](before-arrival.png) | [After](after-arrival.png) |
| Entrance/stair | [Before](before-entrance.png) | [After](after-entrance.png) |
| Poolside | [Before](before-poolside.png) | [After](after-poolside.png) |
| Interior | [Before](before-interior.png) | [After](after-interior.png) |
| Upper suite | [Before](before-upper.png) | [After](after-upper.png) |
| Pool detail | [Before](before-pooldetail.png) | [After](after-pooldetail.png) |
| Loggia | [Before](before-loggia.png) | [After](after-loggia.png) |

The observed failure is a disconnect between architectural explanation and scene operations. No subjective lesson has been added to approved knowledge, and the revision has not been approved.
