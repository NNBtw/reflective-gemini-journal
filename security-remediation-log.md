# Security Remediation Log

> Last curated: 2026-09-06（Asia/Taipei）
> Scope: security findings、risk decisions、remediation、verification evidence and residual risk. General feature chronology belongs in `development-change-log.md`; current operational state belongs in `PROJECT_STATE.md`.

## Recording standard

- Each finding has a stable ID、status、affected boundary、remediation and evidence。
- Status values：`Remediated`、`Partial`、`Accepted residual risk`、`Deferred` or `Not deployed`。
- Source review、local tests、Preview behavior and Production behavior are identified separately。
- A control is not called deployed until runtime publication and human verification are both evidenced。
- Secrets、full tokens、payment details、real journal content and identifying test data are never recorded。
- Historical pre-curation wording remains recoverable from Git at commit `b07f9710b54755cc3a90a04e2cb6a80f42d17ff3`。

## Current finding register

| ID | Finding | Status | Current evidence |
|---|---|---|---|
| SEC-01 | Public Gemini API trusted the frontend sign-in state | Remediated | Firebase ID token required and verified before model routes；Production authenticated flow passed |
| SEC-02 | Malformed token paths could return a generic server error | Remediated | Fixed `401 INVALID_TOKEN` mapping；local malformed-token matrix passed |
| SEC-03 | Firestore needed owner and nested-schema enforcement | Remediated | Owner-bound Rules deployed；Emulator `31/31` and cross-account Preview checks passed |
| SEC-04 | Empty journal first-message Rules transition failed and generation could proceed across a failed persistence boundary | Remediated | Rules and frontend persistence gate deployed；Preview and Production reload persistence passed |
| SEC-05 | App Check client exists but Firestore enforcement is off | Partial | Public-domain client activation verified；Console remains `Monitoring / Unenforced` |
| SEC-06 | Firebase Web client key is intentionally public and lacks application referrer restrictions | Accepted residual risk | Firebase-only API allowlist narrowed；Production read smoke passed；GitHub alert dismissed with audit note |
| SEC-07 | Rate limits use per-process memory | Accepted residual risk | Pre-auth and per-user limits verified in source；shared multi-instance enforcement not implemented |
| SEC-08 | Server secrets could be exposed to browser or repository | Remediated | Gemini secret remains server-side；focused secret scans passed；no populated env file committed |
| SEC-09 | Generated crisis guidance could be unsafe or overconfident | Partial | Deterministic pre-model response and regional resource tests passed；keyword matching remains limited |
| SEC-10 | Location could be collected automatically or leaked to Gemini | Remediated | Explicit picker only；no geolocation permission；payload boundary and `5/5` location tests passed |
| SEC-11 | Raw backend／Firebase errors could reveal technical details | Remediated | Fixed error allowlists、negative-path Preview QA and server-side logging boundaries passed |
| SEC-12 | Notification integrations could leak journal data | Not deployed | Default-off minimal-payload candidate passed local tests；Production delivery is not claimed |
| SEC-13 | Privileged role changes could allow self-promotion or unaudited mutation | Not deployed | Owner allowlist、recent-auth、confirmation and idempotency tests passed locally；Production bootstrap not performed |
| SEC-14 | Dependency advisories in transitive packages | Remediated at verified checkpoint | Production audit passed after scoped `qs` and `uuid` overrides |
| SEC-15 | Demo and submission media could expose personal data | Remediated for current demo | Synthetic entries and isolated demo account used；signed-out post access verified |
| SEC-16 | Retention and account-level erasure policy is incomplete | Deferred | Individual entry deletion exists；formal retention、account deletion and governance policy remain future work |
| SEC-17 | Public documentation mixed stale blockers、deployed claims and internal logs | Remediated | Five-document role separation、link／secret scan and local test baseline passed |

## SEC-01 — Backend authentication boundary

### Risk

The initial interface required sign-in，but the public Cloud Run Gemini routes did not independently verify that identity。A caller could bypass the UI and spend the project's Gemini quota。

### Remediation

- Frontend sends the current Firebase ID token in the `Authorization: Bearer` header。
- Protected `/api/*` middleware verifies RS256、certificate key、signature、issuer、audience、expiry、issue time and subject。
- Missing、malformed、expired or invalid claims are rejected before Gemini access。
- Public errors remain generic；certificate and provider details stay server-side。

### Evidence

- Source review of `server.ts` and `src/lib/api.ts` — Passed。
- Missing-token and malformed-token local smoke tests — Passed。
- Authenticated Preview／Production Gemini flow — Passed。
- Certificate-matched invalid-signature runtime variant — not independently executed because the earlier local TLS path could not retrieve Google certificates；this does not override the other passed cases。

## SEC-02 — Authentication error classification

### Risk

Unparseable JWT segments originally fell into a generic `500 INTERNAL_ERROR` path。The response was sanitized，but authentication failures should be classified consistently as `401`。

### Remediation and evidence

- Wrapped JWT decoding and signature-verification exceptions in fixed `401 INVALID_TOKEN` handling。
- Fresh exported source passed TypeScript、Production build and malformed-token regression。
- No authentication bypass or Gemini call occurred in the failing pre-fix case。

## SEC-03 — Firestore authorization and document integrity

### Risk

Authentication alone does not prevent cross-user reads or malformed writes。Rules must bind the path owner and validate every client-writable structure without exceeding Firestore evaluation limits。

### Remediation

- Entries live under `/users/{uid}/entries/{entryId}` and require `request.auth.uid == uid`。
- Top-level user documents remain inaccessible。
- Required／allowed fields、types、title、tags、mood、timestamps、summaries、takeaways、messages and locations are bounded。
- `id`、`userId` and `createdAt` are immutable。
- Create permits zero-to-two validated messages；update permits unchanged history、one validated append or a one-message rolling transition at 20 messages。
- Client access to `_adminAudit` and `_notificationEvents` is denied。

### Evidence

- Initial whole-array design：14／15 tests passed；valid 20-message write hit Firestore's 1,000-expression limit — Failed。
- Transition-validation revision：21／21 Passed。
- First-message regression expansion：31／31 Passed。
- Preview two-account isolation and sign-out boundaries — Passed。
- Updated Rules compiled、uploaded and released to the named Production database through user-operated Firebase CLI — Passed。

## SEC-04 — First-message persistence boundary

### Risk

For an existing blank entry，the Rules expression evaluated an invalid `messages[0:0]` slice。The UI could call Gemini even though the user's first message had not persisted，creating cost and misleading success behavior。

### Remediation

- Rules explicitly handle previous message count zero and validate `nextMessages[0]`。
- `handleUpdateEntry` returns persistence success／failure。
- Journal chat stops before Gemini when the user-message save fails。
- Gemini and summary completion are not reported when their final Firestore save fails。

### Evidence

- Exact frontend-shaped Emulator regression reproduced `Index out of bound` before the fix。
- After remediation：Rules `31/31`、security `13/13`、location `5/5`、TypeScript and Production build Passed。
- User-operated Preview and Production first-message、Gemini response and reload-persistence checks Passed with no Firestore permission error。
- Actual Production metadata：`modelUsed = gemini-3.6-flash`。

## SEC-05 — Firebase App Check

### Risk

Authentication and Rules protect user data，but automated clients may still attempt Firebase abuse。App Check adds an application-attestation signal，yet premature enforcement can block legitimate or reviewer browsers。

### Current control

- `src/lib/firebase.ts` initializes App Check using `ReCaptchaEnterpriseProvider` and automatic token refresh。
- The Production reCAPTCHA Enterprise key is restricted to the published hostname。
- Public Production assets and ordinary Chrome traffic confirmed client activation。

### Residual risk and decision

- Cloud Firestore App Check remains `Monitoring / Unenforced`。
- AI Studio Preview uses transient `run.app` origins that do not match the Production key；Preview warnings are expected and are not evidence that Production is unavailable。
- Mixed historical validity metrics do not support enforcement immediately before challenge review。
- Post-submission action：collect clean real-browser metrics、verify authorized domains and only then consider staged enforcement。

## SEC-06 — Firebase Web API key exposure

### Finding

GitHub secret scanning detected `firebase-applet-config.json:apiKey`。This value is a Firebase Web client identifier loaded by browser code，not the Gemini or Maps server credential，but unrestricted use can still create Auth／quota abuse risk。

### Remediation

- Confirmed Gemini and Maps secrets come from separate server runtime variables。
- Removed unused Firebase AI Logic、Cloud SQL Admin and Firebase SQL Connect APIs from the key's API allowlist。
- Preserved only APIs required by the deployed Firebase Authentication、Firestore、App Check and management flow。
- Production landing、existing auth state、journal list and journal read passed after propagation。
- GitHub alert `#1` was dismissed as `Won't fix` with an audit explanation for intended public Firebase Web configuration。

### Residual risk

- Application restrictions remain `None` because the Production custom domain、Cloud Run endpoints、AI Studio Preview and development origins were not yet proven under one safe restriction policy。
- App Check enforcement also remains off。
- Post-submission：inventory required browser origins，apply least-privilege website restrictions，then repeat Auth／Firestore Production smoke tests。

The full key is intentionally omitted from this log.

## SEC-07 — Abuse and cost controls

### Implemented controls

- Pre-authentication API limit：60 requests per IP per 10 minutes。
- Authenticated generation limit：20 requests per UID per 60 minutes。
- Separate limits for Maps config、admin and notification routes。
- Gemini payload bounds：20 messages、4,000 characters per message and 16,000 total characters。
- Retryable-only fallback for `429` and selected `5xx` provider errors。

### Residual risk

The buckets are process-local memory。Multiple Cloud Run instances do not share counters，and restarts reset state。For broader Production use，move rate data to a shared store and consider Cloud Armor、budget alerts and service quotas。A Cloud Billing alert is monitoring，not a hard cost cap。

## SEC-08 — Secrets and credential handling

### Controls

- `GEMINI_API_KEY` is read only by `server.ts` from runtime environment／Secret Manager。
- Maps configuration is exposed only to an authenticated picker because a Maps JavaScript browser key must reach the browser by design。
- `.env*` files are ignored except the placeholder-only `.env.example`。
- OAuth secrets、refresh tokens、webhooks and service-account material are never valid client fields or documentation content。
- Repository scans distinguish live-secret patterns from synthetic Slack／Discord validation fixtures and public Firebase／reCAPTCHA site identifiers。

### Evidence

- Focused source and candidate secret scans — Passed after fixture review。
- Git history publication gate — Passed with only the audited Firebase Web client-key finding。
- Cloud Run Gemini generation succeeded without the secret appearing in client source or response payloads。

## SEC-09 — Mental-health safety boundary

### Risk

A generative model should not improvise emergency or diagnostic guidance，and an automated journaling tool must not be presented as treatment or crisis care。

### Controls

- High-risk keyword matching runs before Gemini generation。
- A match returns deterministic resources selected from an explicit user preference，never GPS、pinned location or model inference。
- The product copy states that Reflective is not a therapist、medical device、diagnostic tool or emergency service。
- No automatic call、message or emergency-contact action exists。

### Evidence and residual risk

- Crisis-resource tests：4／4 Passed，including India、Taiwan、global fallback and no automatic contact behavior。
- Long-message crisis Preview test — Passed。
- Regex／keyword matching can miss indirect language or create false positives。Clinical governance、localized legal review and incident ownership remain outside this prototype。

## SEC-10 — Location privacy and Maps credential boundary

### Risks

- Automatic geolocation would collect data without the intended consent model。
- Exact coordinates could leak into Gemini prompts、logs or exports after removal。
- A browser Maps key with an incorrect referrer boundary could be abused or fail in Preview。

### Controls

- Device geolocation permission is disabled by response policy and no geolocation API is called。
- User explicitly opens the picker、selects a point and saves or removes it。
- Firestore accepts only bounded latitude、longitude and optional label fields。
- Gemini chat／summary payloads omit location；server instruction prohibits location inference or disclosure。
- Production and Preview use separate Maps browser keys restricted to their exact intended origins and only the Maps JavaScript API。

### Evidence

- Location unit tests：5／5 Passed。
- Firestore location Rules matrix — Passed。
- Preview pin／save／reload／remove and export cleanup — Passed。
- Production Maps load and persistence lifecycle — Passed。
- Production key correctly failed closed in Preview with `RefererNotAllowedMapError` before the separate Preview key was applied。

## SEC-11 — Error redaction and failure integrity

### Controls and evidence

- Chat and summary surfaces map known failures to fixed user messages。
- Provider response text、billing details、Firebase SDK wording and stack traces are not persisted as journal messages。
- Offline summary and chat negative paths preserved user input／existing summary and recovered without duplicate messages — Passed。
- The first-message persistence gate prevents cost-incurring generation after a failed initial write — Passed in Production。

## SEC-12 — External notification candidate

### Design

- Notifications default off and require explicit preference storage。
- External payloads contain only a generic event label and sign-in link，not journal content、summary、location or crisis text。
- Slack／Discord hosts and paths are allowlisted；Gmail MIME headers are sanitized。
- Server-only delivery records reject browser access。

### Evidence and boundary

- Notification tests：5／5 Passed locally。
- No Gmail OAuth authorization、live webhook delivery or Production notification smoke is recorded。
- Status：**Not deployed**。Do not claim external notifications in demos or submission copy。

## SEC-13 — Privileged RBAC candidate

### Design

- Roles are constrained to `user`、`admin` and `owner` custom claims。
- Only a recent-authenticated，environment-allowlisted owner can invoke mutation paths。
- Self-promotion、stale auth、missing confirmation、invalid target／reason and reused idempotency keys are rejected。
- The AI policy is advisory only and cannot grant authorization or handle credentials。

### Evidence and boundary

- RBAC tests：4／4 Passed locally。
- CLI scripts and package commands are present in the repository。
- Owner bootstrap、live role mutation and Production admin workflow are not verified。
- Status：**Not deployed**。Do not claim privileged administration in public demos。

## SEC-14 — Dependency and supply-chain checks

- Production dependency audit originally identified transitive issues addressed through scoped `qs` and `uuid` overrides。
- Verified candidate audit、TypeScript and Production build passed after the overrides。
- Lockfiles are committed；generated dependencies and build artifacts remain ignored。
- Continue routine audit refreshes after submission，because dependency status changes over time。

## SEC-15 — Demo privacy

- Formal demo uses synthetic journal text and a dedicated isolated Google demo account。
- Generic avatar and demo display name are non-sensitive；password、OTP、recovery information and Cloud Console secrets must never appear。
- LinkedIn post was verified by the user in a signed-out browser：public content、video playback、required hashtag and no login requirement all Passed。
- A higher-resolution YouTube mirror may be added，but the required social-post URL remains the public LinkedIn post。

## SEC-16 — Data lifecycle and governance

- Users can delete individual journal entries and export them as Markdown。
- The repository does not yet define a formal retention period、account-level erasure workflow、data-processing notice、incident-response owner or clinical governance process。
- These are acceptable documented limitations for the current Ideathon prototype，not claims of regulatory readiness。

## SEC-17 — Public documentation integrity

### Risk

The earlier README、handoff and architecture files repeated chronological status updates。Superseded `unpublished`／`blocked` statements appeared near later Production passes，making it difficult for reviewers to distinguish deployed behavior from repository-only candidates。Excessive duplication also increased the chance that a security status would drift between files。

### Remediation

- Assigned one authoritative purpose to each first-party Markdown file。
- Rewrote README、PROJECT_STATE and CONTEXT as current public／handoff／architecture snapshots。
- Curated development history separately from this security finding register。
- Kept privileged RBAC、external notification、App Check enforcement and Firebase-key application restrictions explicitly labeled by deployment／residual-risk state。
- Preserved full pre-curation evidence in Git commit `b07f9710b54755cc3a90a04e2cb6a80f42d17ff3` rather than duplicating it in public entry documents。

### Evidence

- Five first-party Markdown files inventoried；role overlap reviewed。
- Local Markdown links：0 missing targets。
- Focused documentation credential patterns：0 matches。
- Stale path／status phrase scan：0 matches in the curated documents。
- TypeScript、Production build、location `5/5`、security `13/13` and Firestore Rules `31/31` all passed without application source changes。
- Final local Git diff check — Passed。Remote publication and human merge remain required before this documentation branch is represented as public `main` content。

## Verification index

| Control family | Latest evidence |
|---|---|
| Authentication boundary | Local negative-path checks plus authenticated Preview／Production flow |
| Firestore authorization | Emulator `31/31` plus deployed Rules and Production persistence smoke |
| Security modules | RBAC `4/4`、notifications `5/5`、crisis resources `4/4` |
| Location privacy | Unit `5/5`、Rules cases and Preview／Production lifecycle |
| Build integrity | TypeScript and Production client／server build Passed |
| Secret hygiene | Focused source／documentation scans Passed；public Firebase client identifier separately audited |
| App Check | Client activation Passed；enforcement Deferred |
| Demo privacy | Synthetic content and signed-out social-post access Passed |

## Post-submission security priorities

1. Establish a tested browser-origin inventory and apply Firebase Web key application restrictions。
2. Collect clean App Check metrics and evaluate staged Firestore enforcement without blocking legitimate reviewers。
3. Move rate limiting to shared infrastructure before multi-instance scale。
4. Add the expired-session UI regression and certificate-matched invalid-signature test path。
5. Define retention、account deletion、privacy notice and incident-response ownership before broader public use。
6. Treat RBAC and external notifications as separate releases requiring explicit credentials、deployment and Production verification。
