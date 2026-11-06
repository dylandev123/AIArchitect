# Queued automatic run: missing development worker

The actual run is `386d0a81-92a3-4871-8252-c93aaeec4dce`, attached to Mediterranean Garden House — Automatic Live Test 1. It was persisted as `ready`, `automatic:true`, with an empty call ledger. The approval was consumed only to bind this run; no provider reservation or dispatch was made. There are no provider responses, validation findings or checkpoints because Stage 1 never began. Recorded spending and held spending are both **US$0**. This is not a completed/failed/uncertain Terra response, provider timeout, unresolved stage promise or post-response construction exception.

## Exact cause

The running development server (PID 69077) started 5 November at 08:04:42 America/St_Lucia. The instrumentation source that starts the worker was added at 08:42:53 that day (12:42:53 UTC). Next's instrumentation register is a server-start hook. The old process had no compiled development instrumentation bundle, no heartbeat and no worker-error activity. Hot updates to routes/UI had applied subsequent changes, but they had not installed that startup worker into this already-running process. The UI could accept an automatic job without proving worker availability.

Every stage was Pending because every stage really was pending. “Creating your house” incorrectly presented a queued job as active generation. Polling was displaying the durable `ready` state; it was not losing an accepted checkpoint. The old development log contained browser navigation/render warnings but no provider dispatch, worker progress or generation exception explaining a billed call. A current production build artifact was not proof that the running development process had loaded its worker.

## Corrections and safe operational recovery

Added a local worker heartbeat that runs independently of a provider promise. Missing/stale worker health is visible in owned status reads. Automatic admission now rejects before consuming an approval if the worker is unavailable or execution is held. The browser polls health even before a run and disables Generate House when the worker is missing/held. A `ready` run now says Queued for generation, Generation worker unavailable, or Generation on hold. Completed-stage counts and failed/uncertain handling remain tied to accepted checkpoints.

A local `generation-hold.json` operational marker was placed outside the job database after confirming no call was active. It is checked by worker ticks and immediately before call reservation. This prevents even a healthy restarted worker from starting paid work during this investigation. No saved run, project, approval, session, spending record or provider evidence was altered. The real state file was hash-checked byte-for-byte unchanged throughout.

After establishing there was no active generation to terminate, the old development process was restarted under that hold. The fresh server compiled its development instrumentation bundle and now writes a fresh heartbeat. Startup completed successfully; no provider request or reservation followed. The restart did not restart/retry a paid call, because none existed. The worker is now operational, and the existing ready job can resume under the already consumed single-use authorization. It does not require a new run or approval.

**Current disposition:** leave the existing job operationally held to comply with the user's instruction that this investigation must trigger no paid calls. Do not click Generate House again. On explicit instruction to resume this same job, verify its unchanged empty ledger and healthy worker, then release only the operational hold. The existing server worker can then start Stage 1 and advance automatically. That action will make the first paid request; it was not performed here.

## Verification

21 relevant files / 192 tests passed. After final heartbeat/polling adjustments, all 25 automatic worker tests passed again. Typecheck, targeted ESLint and production build passed. Tests include a heartbeat continuing during a blocked provider promise, duplicate prevention, unknown accounting, checkpoint preservation, hold enforcement with unchanged database contents, and rejection before consuming an approval when worker health is missing.

The existing isolated offline browser workflow passed for active Stages 1–5, completed counts, refresh during generation, completed editable import/reopen, saved failure after refresh and cancellation. Separate isolated browser checks show a missing worker disables Generate House, health polling enables it when healthy, a queued job is labelled accurately, and the operational hold shows all five stages still Pending without claiming active generation. Providers were mocked; external browser traffic was blocked. No real calls were made.

See [actual sanitized run evidence](run-evidence.json), [server diagnosis](server-diagnosis.json), [verification](verification.json), [full browser results](browser.json), [queue browser results](queue-browser.json), [held queue](held-queue.png) and command outputs in this directory. Account credentials/session data were excluded from retained evidence. No commits, pushes, deployment or production database changes occurred. Live Terra architectural performance remains untested.
