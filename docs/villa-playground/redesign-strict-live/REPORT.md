# Single strict-schema Terra Redesign test

Completed 2026-10-28. Existing OPENAI_API_KEY reused without modification or exposure. Exactly one live provider request, zero retries. No database or learning writes. Original scene and prior paid-call evidence remain unchanged. Candidate is separate and UNAPPROVED; it has not been applied to a project.

## Preflight and provider result

47 focused tests passed across route, serialized provider schema and redesign persistence. The offline harness inspected the actual SDK wire request with zero provider calls. All nested schema objects require every property, close additional properties, omit defaults and represent optional properties as nullable. The live transport independently checked that exact schema, strict:true, model and output budget before sending. Harness ESLint passed.

Model: gpt-5.6-terra. HTTP 200; provider status completed; finish reason stop; no incomplete details. Output budget 30,000 tokens. Durable attempt marker and transport guard prevent a second call.

## Architectural result

Terra supplied a complete architectural plan and executable transaction, rather than concept-only prose. 100 operations: 51 remove, 8 replace, 41 add. Result: 57 elements, compared with 67 originally. Nine retained IDs have changed geometry, including a dependent roof adjustment by the executor; this is distinct from the eight explicit replace operations.

The candidate establishes a dominant 18 m salon, north arrival gallery, lower lounge/dining/service wings, sheltered ocean loggia and separated upper suite enclosures, with limestone, ivory, timber and bronze materials. The overlapping retreat floor and problematic elevated terrace decks/rails are removed. Floor-overlap audit is clear; relationship issues fall from two to zero. JSON validation and reload roundtrip pass. Pool elements and terrain match the original exactly.

Architectural status remains INCOMPLETE. Three attached doors (gallery-salon-door, salon-guest-door, salon-dining-door) have local Y=-0.1 while their wall openings require Y=-1.7. Two knowledge claims lack required cited geometry kinds (wall and plate). Space allocation and enclosure completeness remain unverified. Stairs/lift, upper circulation, bathrooms, closets, kitchen equipment, services, engineering and code compliance are unresolved. The unchanged pool still lacks basin/perimeter evidence. Passing operation/relationship validation does not establish architectural completeness. No post-response repairs were made.

## Token usage

Provider usage: 11,353 input + 9,168 output = 20,521 total tokens. Output includes 2,786 reasoning tokens and 6,382 text tokens. Raw provider input details report 11,350 cache-write tokens and zero cached-read tokens. No monetary cost inferred.

## Retained artifacts

- provider-response.raw.json: exact provider response body
- response.json: parsed output, SDK usage and finish reason
- operations.json: executable operations
- after.UNAPPROVED.json: separately resolved candidate
- audit.json: operation counts, differences, preservation checks and architectural warnings
- preflight.json: actual SDK wire payload, without headers or credentials
- settings.json, request.json, system.json, response-format.json: reproducible configuration and original scene context
- live-attempt.json, transport.json, http.json: single-request evidence
