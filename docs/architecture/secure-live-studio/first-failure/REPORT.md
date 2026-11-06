# First private Studio live failure

The first real call completed normally but failed local structured-output validation. The UI's “Stage 0” counts accepted checkpoints: the attempted provider stage was **1, architectural direction**, not a separate stage-zero contract. No checkpoint was accepted and no retry occurred.

## Exact finding

Revalidating the unchanged [recorded response](recorded-direction.json) against `directionSchema` produces exactly one issue: `palette.roofColor` fails `/^#[0-9a-fA-F]{6}$/`. Terra returned `warm terracotta clay tiles`. All remaining fields validate when only that field is replaced with a valid example hex value in an offline test. The response contains a coherent named concept, mass hierarchy, roof/arrival/veranda/landscape descriptions and valid material slots. This is useful design direction, not constructed or accepted geometry.

The provider finish reason was `stop`; usage was 563 input tokens, 564 output tokens, zero cached input and zero reported reasoning tokens. The settled ledger records **$0.007894**, one call, no token-limit violation. There is no uncertain dispatch. See [evidence](evidence.json).

The saved input matches the approved prompt byte-for-byte. The exact outbound request and original SDK validation cause were not retained. [Request reconstruction](request-reconstructed-before-fix.json) is explicitly reconstructed from the saved input and pre-fix request builder, not a captured network payload. Raw response replay reproduces the schema issue precisely. There is no evidence of a prompt rewrite; the builder embeds the saved brief verbatim with site and bedroom-count context.

## Contract comparison and correction

Private Studio uses the existing `LiveDesigner`, with the same `directionSchema` used by earlier staged scripts. Stage 1 provider strict-schema enforcement was **false**; local strict Zod validation remained active. This was not an OpenAI strict-schema rejection, truncation, transport failure or adapter renaming/wrapping error: the raw JSON itself supplied prose where a hex color was required.

The older combined concept/massing script explicitly listed material enum choices and “roofColor optional hex.” The separate live designer omitted that guidance. Earlier retained accepted direction uses `#6b4a36`; the Breezeway raw response uses `#4A4037`. The historical Breezeway combined request itself also records an overall schema failure, so it must not be described as an entirely successful provider contract merely because its direction/color was usable.

The correction adds explicit stage-1 palette vocabulary and hex-color guidance to the model instruction and a matching description on the existing roofColor schema field. Validation is unchanged: the exact failed response still fails. There is no runtime color conversion, schema relaxation, automatic repair, extra call or replacement generation system.

## Verification and recovery

28 tests across six files pass, including actual SDK serialization against an intercepted offline transport. The recorded invalid response is rejected with billed usage retained; a clearly labelled offline variant changing only roofColor to `#B65A36` is accepted. Both make exactly one mocked network dispatch. Security, ownership, cost/call admission, idempotency, failed-stage stopping and checkpoint recovery tests pass. Typecheck and focused ESLint pass.

The original failed run and entire spending ledger were hashed before investigation and verified unchanged after testing. The original approval remains consumed by that failed run; no approval was created or reset, and no further paid call was made. The $1.40 admission cap, five-call limit and zero-retry policy remain unchanged.

A further real test needs fresh authorization and a new owned project/run. The failed run has no accepted checkpoint and is deliberately non-resumable; approving it again or silently accepting a patched response would erase the failure boundary. Fresh model compliance with clearer guidance is not proved by offline replay. No commit, push, deployment or database operation occurred.
