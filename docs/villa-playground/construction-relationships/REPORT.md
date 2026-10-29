# Direct-scene construction relationships

The shared `applySceneOperations` transaction now validates geometric support and facade relationships after schema, opening and attachment validation. Terra generation, conversational edits, manual edits and visual-review edits already use this executor. No renderer, schema version, construction engine or migration was added.

- Elevated plates need contact with grounded solids. Support propagates through actual oriented geometry, including intermediate walls, volumes, roofs and side-connected plates. Attachment metadata alone does not ground anything; floating groups cannot support themselves. Volumes remain available for posts, beams and foundations without introducing another element vocabulary.
- Railings need a supported walking surface at their base across their entire rendered X span. The surface may comprise multiple adjacent plates or solids. Balcony/glazing depth cannot stand in for geometry that their renderer does not create.
- Glazing/screens respect wall-host yaw and position after inherited transforms. World-authored panels on wall faces are also checked. Swapped-axis slats intersecting a facade require correction or an explicit parallel wall attachment for deliberate deep fins. Standalone fins and horizontal pergolas remain available.
- Arbitrary yaw, storey count, plate arrangement, split levels, bridges and cantilevers remain supported. There are no footprint, style, massing or overlap-ratio requirements. Contact checks use a 0.16m assembly tolerance; glass/railing depth above 0.3m is rejected because those renderers only create thin glass/framing. This is geometric validation, not structural engineering or a load/span calculation.

Loading/importing saved scenes remains lossless. Transactions reject newly introduced relationship faults, including faults on unchanged dependents when a support is moved or removed. Unchanged legacy faults do not prevent unrelated finishes or edits; changing the faulty geometry requires fixing that relationship. Explicit terrain-only edits retain their existing behavior. New generation retains the existing flat-site policy.

Terra's prompt now explains the implemented primitives, local axes, grounded support, railing/deck separation, wall-host inheritance and atomic edits to supports/dependents. There was no provider evaluation of the prompt: all verification was offline.

## Evidence

`src/lib/villa/scene/relationships.test.ts` checks the exact retained `flat-main-house/original.scene.json` terrace, railing and glazing/screen IDs. It also checks floating attachments, floating support groups, inherited and world-authored facade alignment, missing/short/gapped railing decks, several adjacent deck plates, support removal, move, resize, rotate and attach operations, coordinated edits, persistence, unchanged Casa Ladera, arbitrary yaw and deliberate deep fins.

Two prior freedom fixtures authored floating floor plates. They now include a grounded core for the five-level study and grounded plates for the large-budget study; their original size/count/yaw freedom assertions remain.

Validation: 77 tests passed across 11 focused and compatibility files; TypeScript and focused ESLint passed. The browser replay starts at the real homepage, intercepts every AI endpoint and blocks external requests. It accepts Casa Ladera, rejects four invalid edits without creating versions, accepts a targeted screen edit, verifies unrelated geometry, undo/redo and reload, reopens the exact retained terrain scene unchanged, verifies an unrelated finish/undo, and renders legacy Solana. See `browser-checks.json` and PNGs here. All browser AI responses are local mocks; zero OpenAI calls. No commits or deployment.

Reproduce: `node scripts/scene-relationships-capture.mjs` with the local development server running. The script uses the same local Playwright/Chrome installation as the existing repository capture scripts.
