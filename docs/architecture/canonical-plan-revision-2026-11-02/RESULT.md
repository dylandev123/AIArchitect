# Live result: one Terra plan revision of the saved mansion

**Terra's revision was rejected. It is a real architectural redesign, but it is not physically valid, so nothing was compiled or rendered.** One paid call ran (approved hash `d830dac2…4e8a`, verified byte-identical before sending); no retry, fallback, repair, manual edit, commit, deployment or database access. Terra's plan was never modified.

## Execution and evidence
- [Exact request](provider-request.exact.json) · [HTTP](provider-http.json) (200) · [exact response](provider-response.exact.json) (`completed`) · [exact text](revision.exact.txt) · [call marker](call-started.json) · [usage](usage.json)
- Usage: **21,593 input, 11,774 output (4,007 reasoning), 33,367 total tokens.** [Estimated cost](estimated-cost.json): **US$0.184** at repository default rates (estimate, not an invoice; below the ~US$0.20 forecast; input tokens were within 5% of my 22,700 estimate).
- [Full record](revision-record.json): original plan and hash, Terra's response, diff, every check, all 87 findings by cause. [Terra's plan drawn](plan-view.revised.png). The saved original is unchanged.

## The five questions

**1. Did Terra understand the weaknesses? Largely yes, in reasoning; partly no, in execution.** It declared `redesign`, answered each of the eight cause groups with a specific decision, and used the supplied measurements:
- It set ground rise to **0.3 m**, under the 0.36 m limit, so the known ground-rise constraint was respected (no latent-limit finding).
- It grew the site to 105×100 m, removed every eave overhang, re-keyed the west-wall portals, dropped the screens on conflicted boundaries, and added separate bathrooms. It identified the single-storey, flat-roof, repeated-cell weaknesses itself.
- But it did not re-check its *new* arrangement against the same rules. It repeated the classes of error it was told about.

**2. Substantial architectural improvement, or room rearrangement? Substantial, with limits.** 100% of spaces changed. Measured: two levels with a stair and an upper belvedere (owner suite plus two guest suites); envelope tops spanning **1.2 → 4.8 m**; roof specifications **1 → 5** (flat, hip, gable); separate bath cells (bathrooms 7 → 16; bedrooms 9 → 12); windowless interior area **44% → 31%**. Four of five concept weaknesses clear. One remains and is arguably worse in kind: six identical 9×6 suites plus six identical 4×6 baths. The guest-wing spine concept is still the backbone, so this is an evolved version of the same parti, not a new idea.

**3. Were the major conflicts resolved? No. Errors went from 57 to 87.** The original kitchen/west-suite collision is gone, but the same class recurs:

| Group | Original | Revised | What happened |
|---|---:|---:|---|
| Volume collision | 3 | 1 | `media-lounge` overlaps `east-suite-1` by 8×6 m (a new chain collision) |
| Site | 1 | 1 | The east arrival bed reserve now overlaps `stair-hall` and `upper-landing` |
| Openings | 4 | 15 | Windows authored on facades now shared with baths or neighbours |
| Roof eaves | 44 | 55 | Zero overhangs, but nine **hip/gable roofs on abutting rooms** each add a 0.1 m fascia that intersects neighbours (a rule the contract states only as "separated sections") |
| Screens | 4 | 12 | Screens standing in the new baths, obstructing bath doors |
| Access | 0 | 3 | **No door or passage leads from `upper-landing` to any upper suite**: the whole upper floor is unreachable |
| Roof coverage | 0 | 1 | A hip roof over the partly covered `east-suite-3` |

**4. Did it compile into editable 3D geometry? No.** The compiler stops at the first stage on the media-lounge overlap. Later stages (junctions, stair fit, scene support, staggered walls) never ran, so the revision's further compiler failures are **unknown**: the diagnosis reproduces only some of them, and I did not patch the plan to probe them. The ground-rise stage, which broke the original, is the one thing demonstrably not hit.

**5. Is the result more impressive than the original concept?** **As a plan on paper, probably; as a design, unproven.** The section, roof language, bathrooms and an upper belvedere address what the diagnosis called ordinary. But nothing was constructed or rendered, the upper floor has no entrances, and the guest wings are still repeated cells. There is no basis for calling it more convincing. I am not claiming it.

## Verdict by dimension (indicators, not beauty)
Composition: **improved**. Spatial coherence: **mixed** (windowless share down; errors and unreachable rooms up). Ambition: **mixed** (section range up 1.2→4.8 m; screens 8→5). Overall: **stopped, `physically-invalid`**; `improvement-demonstrated` also failed.

## What this says about the method
- Showing the model its plan and findings did change its design decisions and respected a compiler limit stated only in the context. That part works.
- One bounded revision is not enough to close coordination: Terra fixed the specific collision it was shown and created another of the same kind. The cause is that the model must again author relative placement it cannot check, with the compiler's checks hidden from it.
- Three findings point at contract clarity, not model failure, and would be worth fixing before any further paid test: (a) the instructions never say a pitched roof adds a 0.1 m fascia that makes abutting pitched sections intersect; (b) upper-level spaces need their own doors from the landing, which the prompt does not call out; (c) windows on a wall shared with a bath are a natural consequence of adding baths, so the request should list that check.
- Any next step is a decision for you: a second experiment needs fresh authorization (budget is one revision per experiment); I did not make one. I did not wire this into the UI.

## Reproduce the offline analysis
`npx vite-node --config vitest.config.mts scripts/canonical-revision-review.ts` (already run; refuses to overwrite). The investigation scripts printed and then discarded in scratch files only read the retained record.
