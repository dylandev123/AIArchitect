# First real Studio run — approval packet (NOT APPROVED)

Request:

> Design a beautiful single-storey Caribbean home with three bedrooms, two bathrooms, a pitched terracotta roof, a large covered veranda, a modern kitchen and a small swimming pool. Build it on completely flat land.

| Control | Exact proposed limit |
| --- | --- |
| Execution | Local private Studio at `http://localhost:3015`, signed-in owner only |
| Model | `gpt-5.6-terra`, fixed server-side; no fallback model |
| Site | 60 × 48 m; flat ground at elevation 0 |
| Stages | 1 direction; 2 massing; 3 room programme/solver; 4 exterior; 5 materials/site |
| Maximum paid calls | 5 for the entire run; one per stage; zero correction calls |
| SDK retries | 0; one outbound provider dispatch per persisted reservation |
| Output ceiling | 12,000 tokens per call, including reasoning; 60,000 across five calls |
| Input allowance | 65,536 tokens per call; 327,680 across five calls |
| Enforced wire ceiling | 60,000 UTF-8 bytes for the complete serialised provider request, including schema and prompt; rejected before network dispatch if exceeded |
| Configured price snapshot | $2 / million uncached input; $0.20 / million cached input; $12 / million output |
| Reservation per call | $0.275072 at the full uncached input allowance and output ceiling |
| Maximum five reservations | $1.375360 |
| Hard run admission cap | $1.40; server declines any reservation that would exceed it |
| Timeout | 170 seconds per provider call; five calls have at most 14 minutes 10 seconds of provider wait |
| Expected duration | Approximately 3–10 minutes of model work, plus solver time and user inspection pauses; an estimate, not a measured live result |
| Existing credentials | Existing server-side OpenAI configuration only; no key creation, copy, rotation or modification |
| Persistence | Owner-scoped, fsynced local state under ignored `.data/private-studio`; accepted checkpoints and usage retained across requests/restarts |

The input token allowance conservatively exceeds the entire UTF-8 wire size by 5,536 tokens of protocol/framing headroom. This is a conservative text-only byte bound, not a provider-reported token count. Images, tools and streaming are not enabled on this path. Actual usage is taken from the provider, including cached input and reported reasoning details. Prices above are the existing repository's configured Terra rates; they are snapshotted into the approval policy and are not a newly verified provider invoice. The dollar admission cap is enforced against that explicit rate snapshot. If the provider's contractual rates differ, this estimate must be updated and approved before the test; the application cannot change provider invoicing.

## Stop conditions

Stop immediately on schema rejection, invalid measured geometry, unsatisfied bedroom/bathroom/storey requirements, non-normal provider finish, provider error, timeout, oversized input, wrong model/output contract, exhausted call/cost allowance, stale stage, ownership/session/CSRF failure or persistence failure. No automatic correction, model retry or one-shot regeneration occurs. Missing usage or an interrupted dispatch retains the full reservation and blocks further spending. A provider-reported token/reservation violation also stops the run. The last accepted building remains available; incomplete or rejected output is not a completed house. A successful five-stage run is not guaranteed.

Each accepted stage is inspectable in the normal viewer. The user explicitly continues to the next stage. A complete result is saved on the server and can be imported into normal Studio history with its semantic source, then reopened from the server after a refresh. Paid edit routes remain disabled; normal manual editing and the existing deterministic semantic executors are preserved.

## Activation after explicit authorization

1. Open the Studio on localhost:3015. In **Private live Studio**, use the local one-time setup code to create a Studio password (minimum 14 characters). The code file is `.data/private-studio/setup-code`; it is never returned over HTTP. Existing email-only login is irrelevant. This private backend is disabled in production/Vercel and is not approved for remote HTTP hosting.
2. Review this exact packet and explicitly authorize the single run up to $1.40. No approval has been inserted in the real local store. After authorization, Codex can record one local approval bound to the authenticated owner, this exact brief hash and the entire policy hash; there is no browser/API endpoint that grants approvals.
3. In the Studio create an owned server project, leave this exact description in the live input, and click **Start approved live generation**. Inspect each stage and use **Run next live stage**. No manual generation scripts are needed. After a lost connection use **Read saved live run**, not another start request. Finish with **Import completed live house into Studio**.

A changed description or policy needs a new explicit approval. One approval is consumed by one run. Legacy paid endpoints remain blocked even after this specific run is authorized. Do not delete the local state or lock files to reset spending; interrupted/unknown calls require reconciliation first.
