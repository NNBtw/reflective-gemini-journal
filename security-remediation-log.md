# Security Remediation Log

Project: Reflective Gemini Journal Companion
Date started: 2026-09-03
Status: Canonical candidate assembled and locally verified; GitHub commit／push, App Check enforcement, and privileged RBAC E2E remain pending

## Audit baseline

The initial read-only review identified the following confirmed risks:

- The public Cloud Run endpoints `/api/chat` and `/api/summarize` did not verify Firebase ID tokens.
- The frontend did not send an `Authorization: Bearer <Firebase ID token>` header.
- The Gemini endpoints had no per-user or per-IP rate limit.
- The fallback ladder retried every error, including non-retryable client and authorization errors.
- Request bodies, message history, titles, tags, and prompt size lacked production-safe limits.
- Detailed provider errors were returned to the browser.
- Firestore rules enforced owner-path isolation but did not validate document fields or types.
- Firebase App Check was not initialized.
- The mental-health experience had no deterministic crisis-safety response.

## Confirmed strengths before remediation

- `GEMINI_API_KEY` was read only from the server environment.
- `.env.example` contained placeholders only.
- `.gitignore` excluded `.env*` while retaining `.env.example`.
- Firestore rules denied cross-user access by requiring `request.auth.uid == userId`.

## Remediation record

### 2026-09-03 — Backend trust boundary

- Added Firebase ID-token verification to the public Express API.
- Validation checks the JWT algorithm and key ID, verifies the RS256 signature with Google's Secure Token certificates, and validates issuer, audience, expiry, issue time, authentication time, and UID.
- Protected both `/api/chat` and `/api/summarize`; `/api/health` remains public but no longer exposes whether a Gemini key exists.
- Added a pre-authentication IP limiter and an authenticated per-user limiter. The prototype limit is 20 Gemini requests per user per hour.
- Reduced JSON input from 10 MB to 128 KB and added explicit limits for history length, message size, title, tags, total conversation characters, and model output.
- Changed the fallback ladder so only temporary `429` and `5xx` failures move to another model.
- Replaced provider error details returned to browsers with stable, generic error codes.
- Added basic headers to disable framing, MIME sniffing, and unused camera, microphone, and geolocation permissions.

### 2026-09-03 — Frontend authentication and data bounds

- The Gemini request now obtains the current Firebase ID token and sends it as `Authorization: Bearer <token>`.
- Added client-side limits that match backend and Firestore constraints: 120-character titles, 40-character tags, 10 tags, 4,000 characters per message, and 20 stored conversation messages.
- A missing or expired session stops the request before it can reach Gemini.

### 2026-09-03 — Firestore rule source

- Replaced broad owner-only writes with separate read, create, update, and delete conditions.
- Added required-field and allowlisted-field checks.
- Added type and size validation for entry IDs, owner IDs, titles, timestamps, tags, moods, messages, summaries, takeaways, and word counts.
- Made `id`, `userId`, and `createdAt` immutable after creation.
- Removed the unused `interactions` write surface and denied direct writes to the parent user document.
- Live deployment is intentionally pending because publishing security rules changes cloud-data access behavior and requires a final confirmation.

### 2026-09-03 — Mental-health safety

- Added a deterministic pre-model check for explicit English and Chinese self-harm or suicide phrases.
- Matching requests do not call Gemini. The fixed response prioritizes immediate human support and lists Taiwan emergency services (`110` / `119`), MOHW Lifeline (`1925`), LifeLine (`1995`), and Teacher Chang (`1980`).
- Updated the Gemini system instruction to prohibit diagnosis, treatment claims, confidentiality promises, or claims that the app prevents suicide.
- Documented that this keyword safeguard is not a clinical risk assessment and can produce false positives or miss indirect language.

### 2026-09-03 — App Check preparation

- Added reCAPTCHA Enterprise App Check initialization with automatic token refresh.
- Initialization is inactive while `recaptchaSiteKey` is empty, so the existing preview continues to work.
- A first attempt used an SDK export unavailable in the installed Firebase bundle. The implementation was corrected with a hot-reload-safe global initialization guard; the preview was rechecked and the runtime error cleared.
- Key registration, traffic monitoring, and enforcement remain pending.

### 2026-09-03 — Dependency remediation

- A local dependency audit found two Moderate denial-of-service advisories in transitive `qs 6.15.3`.
- Upgraded Express from `4.x` to `5.2.1`, upgraded its TypeScript definitions, changed the SPA wildcard route to the Express 5 syntax, and pinned `qs` to `6.16.0` or newer through the package override.
- Re-ran the dependency audit after the override: 0 Critical, 0 High, 0 Moderate, 0 Low advisories across 450 resolved dependencies.

### 2026-09-03 — Verification evidence

- AI Studio checkpoints were created for every manual edit.
- AI Studio preview loaded the landing page after backend authentication, frontend token, Firestore source, field-limit, App Check, README, Express, and dependency changes.
- The final preview debug panel showed backend startup and pre-warming logs with no application error.
- Local `tsc --noEmit` completed successfully against the exported project.
- Local dependency audit completed with zero known advisories after the `qs` override.
- The local Vite build reached the tooling stage but was blocked by the Codex filesystem sandbox while esbuild tried to inspect a parent directory. AI Studio's own build and preview succeeded, so this is recorded as an environment limitation rather than a verified code failure.

### README work

- Replaced the generated template README in AI Studio with a first-person, human-written project narrative.
- Added motivation, architecture, features, threat-driven fixes, crisis-safety behavior, setup instructions, verification checklist, limitations, and Codelab attribution.
- Avoided unverified claims such as end-to-end encryption, clinical effectiveness, or completed App Check enforcement.

## Cloud configuration update — 2026-09-03

- Published the hardened Firestore rules to database `ai-studio-d82d6296-0049-4433-955f-91f203831d05` in project `jimmy-gemini-journal`. Firebase confirmed the rules were published and noted that propagation can take up to one minute.
- Enabled the reCAPTCHA Enterprise API for the same project.
- Created the `reflective-journal-app-check` Web key and restricted it to `reflective-journal-ai-companion.ai.studio`.
- Registered the Web app `ai-studio-applet-webapp` with Firebase App Check using reCAPTCHA Enterprise. Firebase confirmed successful registration.
- Kept App Check enforcement disabled so legitimate traffic can be observed before enforcement.
- Added the public reCAPTCHA site key to `firebase-applet-config.json`; no private reCAPTCHA credential was added to source code.
- AI Studio eventually reported the earlier hardened publish as successful after initially returning `Failed to generate API key, The request is suspicious.` The public backend was verified to be the hardened version by an unauthenticated request that returned `401 AUTH_REQUIRED`.
- A later republish containing the App Check site key failed twice with the same AI Studio API-key-generation error. AI Studio returned the existing deployment to `Ready`, but a no-cache inspection of the public JavaScript bundle confirmed it still does not contain `ReCaptchaEnterpriseProvider` or the new public site key. The source and Firebase registration are complete; client-side App Check activation remains a platform-blocked deployment step.

## App Check production activation — 2026-09-03

- Reopened the app under the explicit `jimmy-gemini-journal` project context and confirmed that AI Studio source still contained `recaptchaSiteKey`, `ReCaptchaEnterpriseProvider`, `initializeAppCheck`, and automatic token refresh.
- A user-initiated `Republish` progressed through AI Studio's publishing pipeline and returned to `Status Ready` without reproducing the earlier suspicious-request API-key-generation error.
- A cache-busting request to the public site showed that the frontend bundle changed from `index-DlfZi7qZ.js` to `index-DHYh_8uw.js`.
- The public page loaded Google's reCAPTCHA Enterprise client script, confirming that the App Check-enabled frontend reached production.
- The user completed a public authenticated smoke test and reported that the app operated normally.
- App Check enforcement remains disabled until legitimate request metrics are reviewed. This deployment verification does not replace emulator tests or cross-account isolation testing.

## Structured summary output hardening — 2026-09-03

- Google AI Studio created an unpublished `server.ts` checkpoint for the authenticated `POST /api/summarize` route.
- Normal Gemini output is requested as structured JSON and then independently parsed, shape-checked, trimmed, and bounded on the server before being returned to the browser.
- Invalid JSON or incomplete output follows the existing sanitized `502 AI_GENERATION_FAILED` response path; provider details remain server-side.
- The deterministic crisis check remains before the Gemini call and continues to return a separate safety-escalation shape.
- The diff did not alter Firebase token verification, App Check behavior, rate limits, request limits, the retryable model fallback policy, Firestore rules, or security headers.
- AI Studio reported successful TypeScript and production-build checks. Independent local verification is pending a new export, and this checkpoint has not been published.

## Frontend summary integration review — 2026-09-03

- An unpublished AI Studio checkpoint added the authenticated summary request, bounded normal-response validation, persistence through the existing owner-bound entry update path, and a non-persisted accessible crisis banner.
- The diff changes only `src/components/JournalEditor.tsx`; Firebase configuration, Firestore rules, backend middleware, App Check settings, and dependencies were unchanged.
- Security review found that applying `.slice(0, 16000)` after joining the latest 20 messages can discard the newest user message. This can prevent new crisis language from reaching the deterministic backend safety check.
- The catch path can also display arbitrary caught `err.message` text, including raw Firebase SDK authentication errors, rather than limiting the UI to known safe messages.
- Status: **not approved for publication**. Preserve newest user content during request bounding and allowlist UI error messages, then rerun checks and re-review.

## Frontend summary remediation verification — 2026-09-03

- A focused unpublished checkpoint replaced prefix transcript truncation with a boundary-aware newest-to-oldest selection helper.
- The helper guarantees inclusion of the newest non-empty user message, respects the existing 20-message, 4,000-character-per-message, and 16,000-character-total limits, and returns selected segments in chronological order.
- The summary action now exposes only fixed allowlisted messages for authentication, rate-limit, oversized-request, invalid-shape, empty-content, network, and unknown failures.
- Raw Firebase SDK exceptions, `errData.error`, provider details, response bodies, tokens, and stack traces are not rendered or logged by this path.
- The actual diff was reviewed, and AI Studio reported zero TypeScript errors plus a successful production build.
- Status: **code remediation verified; manual safety/error/persistence/export tests and deployment remain pending**.
- A subsequent signed-in Preview test confirmed that the normal authenticated summary path rendered a non-empty summary and three takeaways without a visible error. This does not yet prove refresh persistence, crisis escalation, or negative error cases.
- The user subsequently reloaded the Preview and confirmed that the same summary and three takeaways persisted. The user also inspected the downloaded Markdown export and confirmed both sections were present with no reported error.
- A subsequent synthetic Preview test exceeded the 16,000-character transcript budget and placed the crisis phrase only in the newest user message. The fixed crisis alert was displayed with Taiwan resources `110`, `119`, `1925`, `1995`, and `1980`; no normal Insights card or visible error appeared.
- The user also observed that the summary button was disabled while processing. This verifies the UI duplicate-click guard; a network trace was not captured, so this evidence does not independently prove the exact backend request count.
- The offline Preview path subsequently displayed only the fixed generic retry message, preserved the existing summary, exposed no user-visible technical detail, and recovered after connectivity returned.
- Direct AI Studio debug-panel inspection showed the intended static `[Summary] Request failed` event. The other recorded errors were Vite WebSocket disconnects caused by the deliberate offline interval, not evidence of a TypeScript or application-build failure.
- The debug panel also showed repeated App Check reCAPTCHA token warnings in AI Studio Preview. The key is intentionally restricted to the published app domain, while the Preview uses a transient `run.app` origin. Enforcement remains disabled, so Preview operations continued successfully; public-domain App Check activation was verified separately.
- A subsequent sign-out test returned the Preview to its sign-in state, hid all journals and summary actions, and restored the original account's journal and summary after re-authentication without an error. This verifies the UI access boundary, not a forced expired-token response or cross-account rule enforcement.
- A controlled two-account Preview test then confirmed two-way journal isolation: Account B could not see Account A's marker or existing journals, and Account A could not see Account B's marker after signing back in. Account A's original data returned normally, with no visible error.
- This provides end-to-end UI evidence for owner-scoped data visibility. Automated Firestore Emulator assertions are still required to directly exercise allowed and denied Rules operations independently of frontend behavior.
- Remaining summary-specific security tests are the expired-session allowlist case plus post-publish regression.

## Latest candidate export review — 2026-09-03

- Verified downloaded archive SHA-256: `C2689BB21792A355F90BC494FFF3C9A4D68D309A5FCBFE816321DFBD950C29DD`.
- Local TypeScript check, Vite production build, and esbuild server bundle passed.
- Production dependency audit reported zero advisories at every severity. Source-only scanning found no server Gemini key, private key, OAuth client secret, or Bearer token; the Firebase Web API key remains intentionally client-visible and must stay API/origin restricted.
- Local production-bundle smoke tests returned `401 AUTH_REQUIRED` for missing authorization and `401 INVALID_TOKEN` for a malformed Bearer token before Gemini could be called. Protected responses retained `Cache-Control: no-store`.
- Review finding: Rules validate top-level entry keys but not individual `messages` or `keyTakeaways` elements, and permit 10 takeaways instead of the API/UI maximum of 5. Owner-path isolation remains enforced, but documented schema-integrity claims are not yet fully supported.
- Review finding: the general chat catch path still logs/displays raw caught error wording and persists the operational error as a Gemini journal message. This can expose Firebase/network internals and pollute stored journal data. It should adopt fixed allowlisted UI errors, static logging, and a transient non-persisted error state.
- Status: **do not publish this candidate until both findings are remediated and re-reviewed**.

## Nested Rules and general-chat remediation review — 2026-09-03

- AI Studio modified only `firestore.rules` and `src/components/JournalEditor.tsx` in a new unpublished checkpoint; Rules were not deployed.
- Direct source inspection confirmed fixed chat-error mappings, static logging, transient `role="alert"` rendering, non-persistence of operational errors, and retry without creating another user message.
- Direct Rules inspection confirmed bounded checks for all 10 tag indexes, all 20 message indexes, strict allowed message keys/types/roles/modes, and 3–5 takeaways capped at 240 characters when a summary exists.
- Owner-only collection paths and immutable `id`, `userId`, and `createdAt` protections remain present.
- Status: **the two code findings are remediated at review level, and general-chat offline/retry manual QA passed**. Rules syntax, emulator allow/deny cases, deployment of the new nested-validation revision, and final re-export remain pending.

## General-chat negative-path manual verification — 2026-09-03

- The deliberate offline case rendered only the fixed allowlisted message `Unable to complete AI reflection. Please try again.`.
- The user's reflection was retained; no generated error bubble or technical detail was shown.
- Retry succeeded after reconnection without duplicating the user message.
- A subsequent refresh showed that no operational-error message had been persisted.
- The user saw Retry but did not identify a labeled Dismiss control. Exported source inspection confirmed an icon-only `×` control with `aria-label="Dismiss chat error"`; this does not weaken error redaction, retry safety, or data integrity, but clearer visual labeling remains a low-priority UX improvement.
- Evidence source: user-reported AI Studio Preview QA.
- Security result: **passed**.

## Post-chat-remediation export and malformed-token finding — 2026-09-03

- Archive: `C:\Users\User\Downloads\reflective-gemini-journal-post-chat-remediation-2026-09-03.zip`.
- SHA-256: `985B05FA8C08C0A49E12DA76EF25CA0FC3E86620F1EDB7AA91710B5DFE06B574`.
- Staging: `work/reflective-gemini-journal-post-chat-remediation-2026-09-03/`; prior snapshots were not overwritten.
- Source diff confirmed the intended `firestore.rules` and `JournalEditor.tsx` remediation. TypeScript, frontend build, server bundle, dependency audit, supply-chain lockfile check, and source-only secret scan passed.
- Missing authorization returned `401 AUTH_REQUIRED`, and a parseable JWT using an invalid algorithm returned `401 INVALID_TOKEN`.
- An unparseable three-segment JWT returned a sanitized `500 INTERNAL_ERROR`. Root cause: JSON/base64 segment parsing in `decodeJwtPart()` can throw outside the `ApiError` classification path.
- The malformed request did not authenticate and did not reach Gemini. The remaining issue is incorrect status classification plus avoidable raw parse wording in the server log.
- Required remediation: catch decoding/JSON parsing failures and throw fixed `ApiError(401, 'INVALID_TOKEN', 'Authentication required.')`; verify malformed base64, malformed JSON, invalid algorithm, missing token, and a normal authenticated flow afterward.
- Status: **publication blocked pending the focused malformed-token fix and re-verification**.

## Malformed-token source remediation review — 2026-09-03

- AI Studio modified only `server.ts` (`+15 / -1`) in a new unpublished checkpoint.
- Direct diff inspection confirmed fixed `401 INVALID_TOKEN` conversion for base64url/JSON decoding failures, non-object decoded values, malformed signature buffers, and crypto verification exceptions.
- Existing authentication invariants remain in place, and the new catch blocks rethrow existing `ApiError` instances rather than replacing them.
- The change does not alter Gemini routes, crisis interception, rate limits, security headers, Firestore Rules, frontend code, model fallback, or response schemas.
- AI Studio reported a zero-error TypeScript check and successful production build.
- No deployment or publication occurred.
- Status: **code remediation reviewed and accepted; fresh export plus independent local auth regression remains pending**.

## Malformed-token remediation independently verified — 2026-09-03

- Post-auth archive SHA-256: `D74A136A9C04090C1197E3C78BA54CF1A2C3011A9C658211B9B4B2E87F9C75D0`.
- Staged at `work/reflective-gemini-journal-post-auth-remediation-2026-09-03/` without overwriting earlier evidence.
- TypeScript, frontend/server production builds, dependency audit, supply-chain lockfile check, and source-only secret scan passed.
- The exact previously failing token `abc.def.ghi` now returns `401 INVALID_TOKEN` with `Cache-Control: no-store`, rather than `500 INTERNAL_ERROR`.
- Missing authorization returns `401 AUTH_REQUIRED`; two-segment, non-object JSON, malformed payload JSON, and invalid-algorithm tokens return `401 INVALID_TOKEN` before Gemini use.
- The test server emitted no raw parser/decoder error for the verified matrix.
- A certificate-matched invalid-signature runtime case was not completed because the local PowerShell TLS stack could not retrieve Google's public certificate endpoint. The exported signature exception boundary passed direct source review; this limitation is not represented as a dynamic pass.
- Security status: **malformed JWT classification finding closed in the local candidate**. Expired signed-token testing and post-deployment regression remain pending.

## Multilingual voice feature security and cost guardrails — 2026-09-03

- New requested scope includes UI localization, microphone-based speech input, and spoken AI responses.
- The user set a hard `NT$400` ceiling across prepaid Google Cloud Platform/API usage. Ordinary Cloud Billing alerts do not guarantee a hard stop, so no new paid API is authorized by this feature request alone.
- Initial implementation should use bundled UI translations and browser-provided speech APIs, avoiding new Cloud Translation, Cloud Speech-to-Text, and Cloud Text-to-Speech usage.
- Microphone capture must require an explicit user gesture, display listening/stopped/error states, stop on entry change or component unmount, and never persist raw audio.
- Browser speech recognition may use a remote browser-vendor service. The UI must disclose this before first use and provide text input as a full fallback.
- Speech playback must use only the already-visible AI response, allow Stop, cancel prior utterances before starting a new one, and preserve crisis messages as readable text regardless of voice availability.
- Selected language and voice preferences may be stored locally, but must not weaken per-user Firestore isolation or introduce secrets into client code.
- Universal language wording must remain qualified: BCP-47 selection can be broad, while actual recognition and voice inventory are runtime capabilities of the browser/OS.
- Status: **guardrails documented; implementation not started**.

### Approved first slice boundary

- Implement only `zh-TW`/`en` static UI localization and a language selector.
- Store the locale under a versioned `localStorage` key; do not store it in Firestore or send it to the backend.
- Do not translate journal text, Gemini responses, or the deterministic backend crisis response.
- Preserve fixed allowlisted error handling: localization must use predefined dictionary values and must never reintroduce raw exception/provider text.
- No paid translation/speech service, API key, dependency, Firestore operation, deployment, or publication is authorized by this slice.

### Firestore billing boundary for the planned feature

- The existing named database stores journal entry documents; it is not used for browser language or voice capability discovery.
- Cost-safe V1 stores locale only in `localStorage`, never writes interim speech recognition results, and never stores audio. Language switching and speech playback therefore add zero Firestore operations.
- Cross-device preference synchronization is intentionally out of scope because it would add a profile read and writes. Users on other devices still receive the feature from the hosted frontend but choose or derive a locale independently.
- Existing Firestore usage can still rise indirectly when users send more journal messages. This must remain distinguishable from direct feature overhead in cost reporting.

### UI localization checkpoint security and cost review

- Scope observed in AI Studio: nine files under `src/`; no reported backend, Rules, Firebase configuration, dependency, lockfile, deployment, or publication change.
- `LanguageContext` stores only `en` or `zh-TW` under `reflectai.uiLocale.v1`, guards both reads and writes with `try...catch`, and updates the document language attribute. No account identifier or journal content is stored with the locale.
- Direct `JournalEditor` inspection confirmed the locale is absent from both Gemini endpoint payloads. Existing authentication headers, message construction, summary transcript construction, error allowlists, and deterministic crisis boundary were not changed by the locale integration.
- Direct Preview inspection confirmed pre-existing journal and Gemini content is not translated when the UI language changes. This prevents hidden content mutation and avoids extra Gemini/translation calls.
- Initial Preview errors were App Check reCAPTCHA failure on the transient Preview origin, temporary Firestore unavailability, and Vite WebSocket loss. Reload restored a zero-error render with only the known App Check warning. Do not click automatic `Fix` for this expected Preview-origin condition.
- Cost result for this review: zero intentional Gemini calls, zero new translation/speech API calls, and zero locale-specific Firestore operations. Direct incremental API cost remains approximately `NT$0`.
- Open verification: signed-out selector, keyboard accessibility, blocked-storage fallback, responsive layout, two deliberately bounded cross-language Gemini tests, and Preview inspection of localized Markdown exports.

### Export-label i18n remediation verification

- Fresh ZIP SHA-256: `AA95348AEE9D83191758D8867C0E5BCEB530383D0B8F5752D8955342DA0DCD60`; extracted to a separate `v2` staging directory.
- Direct source diff verified only the four intended product-source files. The backend, Firestore Rules, Firebase configuration, and dependency manifest remained byte-identical.
- Export headings and missing-value fallbacks now come from typed dictionaries. Persisted and generated content is still emitted verbatim and is never sent through translation.
- Both Gemini endpoint payloads remain locale-free, so this remediation introduces no additional prompt tokens, API call, Firestore operation, or content-language override.
- `bun.lock` was empty in this AI Studio export despite an unchanged `package.json`; do not treat the empty artifact as a verified dependency lockfile.
- AI Studio reported successful typecheck/build. Independent local build verification remains pending due to a filesystem restriction in the dependency-link harness.

## Firestore Emulator validation kickoff — 2026-09-04

- Updated the handoff before test work and selected `work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/firestore.rules` as the authoritative local Rules candidate.
- The deployed earlier Rules revision and the newer nested-validation candidate are intentionally distinguished; the newer revision is not represented as deployed or emulator-verified.
- Planned assertions include owner CRUD, unauthenticated and cross-user denial, invalid top-level and nested schema denial, immutable identity/timestamp fields, field-size boundaries, and the summary／3–5 takeaway invariant.
- At this checkpoint no Emulator suite has run, so there is no syntax, allow, or deny pass evidence yet.
- Initial implementation is restricted to local test infrastructure and development dependencies. Any change to `firestore.rules` requires a reproducible failing test and a focused remediation record.
- Environment inspection confirmed that the available Node.js／`pnpm` toolchain does not currently include Java, Firebase CLI, or `@firebase/rules-unit-testing`. This is a local setup prerequisite, not Rules pass/fail evidence.
- The suite will use a synthetic `demo-*` project ID and the Emulator-only Rules testing library; it must not authenticate to or address the production project.
- Added the local harness and installed Firebase CLI `15.28.2` plus `@firebase/rules-unit-testing` `5.0.2`. The package manager refused unapproved lifecycle scripts for `@google/genai` and `re2`; no broad script approval was granted. Direct TypeScript validation still passed.
- A project-local Microsoft OpenJDK `21.0.12.1` archive passed the publisher-provided SHA-256 check, and Firestore Emulator `v1.22.0` downloaded successfully.
- The first suite launch did not reach Rules evaluation because Firebase CLI hit sandbox `EPERM` on its user-level configstore. Configuration is being redirected to an ignored local directory before retry; this failure is not counted as a denied or passed Rules assertion.
- After redirecting the configstore, Emulator startup succeeded and the CLI confirmed demo-project isolation. The `tsx` process then failed before assertions with `uv_os_get_passwd ENOMEM`; this is classified as a local test-runner issue. The harness now uses Node 24's built-in TypeScript/test runner instead of `tsx` for Rules tests.
- The first complete Rules run executed 15 tests: 14 passed and 1 failed. Authentication/ownership denial, top-level and nested schema denials, immutable-field denials, and summary/takeaway constraints were exercised locally.
- Security/reliability finding: an otherwise valid 20-message entry is denied because the current expanded per-index validation exceeds Firestore's 1,000-expression evaluation limit. This creates a mismatch between the allowed schema/product limit and actual runtime behavior. The newer Rules revision remains blocked from deployment.
- Remediation must lower expression cost while preserving explicit validation of all 20 messages. Reducing the allowed message count or removing owner/path checks is not an acceptable shortcut.
- Capacity probe result: 4 fully revalidated messages passed while 6 failed at the 1,000-expression ceiling. Rechecking the whole array could not safely meet the 20-message contract.
- Final Rules design validates transitions: create permits 0–2 fully validated messages; update permits an unchanged list, one fully validated append, or a full-window drop-oldest／append-one roll. Bulk replacement, shortening, invalid appends, and 21 stored messages are denied.
- Frontend review found and fixed the related `JournalEditor.tsx` off-by-one: the Gemini reply path now applies `.slice(-MAX_STORED_MESSAGES)` before persistence.
- Final Emulator result: 21 passed, 0 failed. Coverage includes owner CRUD, unauthenticated/cross-user denial, path IDs, top-level and nested schemas, initial-entry limits, sequential growth to 20, full-window rolling, history rewrite denial, summary updates with 20 messages, takeaways, immutable fields, types, and size boundaries.
- Reproducible runner: `scripts/test-firestore-rules.ps1`; it discovers Java, uses local ignored CLI configuration, and runs only Firestore Emulator under `demo-reflective-rules`.
- Verification after remediation: TypeScript passed; Vite and server production builds passed with the existing non-blocking large-chunk warning; production audit reported no known vulnerabilities; source scan found no private key or Bearer token and only the expected public Firebase Web key plus Gemini environment placeholders.
- Deployment status: local candidate only. No Rules deploy, application publish, production Firestore write, or App Check enforcement change occurred.

## Remaining deployment checklist

- [x] Deploy the hardened Firestore rules.
- [x] Validate representative allowed and denied Firestore cases with emulator tests.
- [x] Register a domain-restricted reCAPTCHA Enterprise App Check key in monitoring mode.
- [ ] Observe legitimate App Check metrics before enabling enforcement.
- [x] Publish the hardened authentication and abuse-control Cloud Run revision.
- [x] Verify unauthenticated API requests return `401 AUTH_REQUIRED` without invoking Gemini.
- [x] Republish the App Check-enabled frontend and verify production activation.
- [x] Complete a user-reported authenticated public-app smoke test after republishing.
- [x] Validate normal summary creation, reload persistence, and Markdown export in the authenticated AI Studio Preview.
- [x] Validate the long-transcript newest-message crisis path and UI duplicate-request protection.
- [x] Validate the controlled offline summary error state and preservation of existing summary data.
- [ ] Validate the expired-session summary error state.
- [x] Validate sign-out UI behavior and same-account data restoration after re-authentication.
- [x] Validate cross-account journal isolation as an explicit two-account Preview end-to-end case.
- [ ] Re-export the final revision and repeat TypeScript, build, dependency, and secret scans.
- [x] Remediate and code-review nested Firestore entry validation and general-chat error redaction/non-persistence.
- [x] Validate general-chat offline error redaction, non-persistence, and retry without duplicate user content.
- [ ] Consider replacing or supplementing the icon-only `×` dismiss control with a clearer visible label; non-blocking.
- [x] Map malformed JWT segment decode/parse and signature-verification exceptions to fixed `401 INVALID_TOKEN` in AI Studio source.
- [x] Re-export the checkpoint and independently rerun the malformed-token auth regression matrix.
- [x] Validate the new Rules independently with the local Emulator suite.
- [ ] Deploy the independently tested transition-validation Rules after explicit approval.
- [x] Verify the UI locale is not sent to `/api/chat` or `/api/summarize` and existing content is not translated.
- [x] Verify signed-in `en` to `zh-TW` switching and locale persistence across Preview reload without a Gemini request.
- [ ] Export the UI-localization checkpoint and independently run typecheck/build/dependency/secret checks.
- [ ] Complete signed-out, keyboard, blocked-storage, responsive, and bounded cross-language QA before publication.
- [x] Validate the signed-out selector, both landing locales, persistence, keyboard selection, and absence of a keyboard trap.
- [x] Add a visible wrapper-level focus indicator and manually verify it on both Landing and Sidebar; exported-source review remains pending.
- [x] Replace hardcoded Markdown export role/model/missing-value labels with typed locale keys and verify the exported source diff.
- [ ] Inspect localized English and Traditional-Chinese Markdown files in Preview.
- [x] Add an accessible localized composer collapse/expand control and remove the broad Phone-landscape/Tablet sidebar-editor collision; user-reported Preview pass, exported-source review pending.
- [x] Remove the visual overlap between the masked `/users/{uid}/entries` path badge and the `Reflective` mood control in Tablet portrait and Mobile landscape; user Preview passed and fresh source/build verification completed.
- [x] Separate the composer collapse control from the AI Lens option strip and provide a bounded horizontal-scroll region: user Preview passed across the affected viewports and fresh source/build verification completed.
- [x] User-reported Preview confirmation: editor-header overlap and AI Lens/collapse-control overlap are resolved; fresh exported-source review remains pending.
- [x] Expand the usable conversation-history viewport in Mobile landscape Sidebar; user-operated AI Studio Preview confirms the cramped-history defect is resolved, and the fresh ZIP passed source/build verification.
- [x] Replace all 70 invalid `landscape:max-h-[500px]:*` prefixes in `Sidebar.tsx` with supported `landscape:max-lg:*` classes via direct Code editing, without a Gemini prompt. Fresh ZIP contains zero invalid and 70 supported prefixes; compiled CSS contains the intended media rules.
- [x] Verify responsive-remediation checkpoint with TypeScript, production build, production dependency audit, and a dependency/build-output-excluded secret scan; all passed, with only the documented Firebase Web key and Gemini placeholder present.
- [x] Record responsive failures without invoking Gemini or enabling any paid API.
- [ ] Sync the complete source to the public GitHub repository and verify that no secrets exist in current or prior history.

### Final source secret scan

- Searched the exported application source while excluding installed dependencies and lockfiles.
- No private key block or OAuth client secret was found.
- `GEMINI_API_KEY` appears only as an environment lookup and documented placeholder.
- The committed `AIza...` value is the Firebase Web configuration API key, not the Gemini server key. It is intentionally client-visible and should still be restricted to the intended Firebase APIs and application origins in Google Cloud Console.

## Google Maps location privacy review kickoff — 2026-09-04

- Exact coordinates are sensitive journal metadata. The feature must require an explicit picker action and an explicit save; it must also offer removal.
- Location will remain inside the existing owner-isolated journal document and will not be added to Gemini chat or summary payloads.
- First scope excludes automatic browser geolocation, Places search, reverse geocoding, and server-side Maps web services, reducing permission, data-sharing, API, and billing surface.
- A dedicated Maps JavaScript browser key must be supplied only through build-time configuration, restricted to approved websites and the Maps JavaScript API. It must not reuse the Firebase Web key or Gemini server key.
- Firestore Rules and automated tests must reject extra location fields, invalid coordinate types/ranges, and oversized labels before this schema is considered validated.
- No Google Maps credential has been retrieved or stored, and no paid Maps API has been enabled or called at kickoff.
- Automated evidence after the first implementation pass: TypeScript passed, location utilities passed 4/4, and the full Firestore Emulator suite passed 24/24 including valid create/update/remove and invalid location schemas.
- Client review found a blank-input coercion risk: JavaScript converts an empty string to numeric zero. Because `0,0` is a valid coordinate, Rules cannot distinguish this UI mistake from an intentional selection. The picker now rejects blank and non-finite coordinate input before normalization, with a dedicated regression test.

## Google Maps location privacy review outcome — 2026-09-04

- Exact location is saved only after explicit confirmation, can be removed with `location: null`, and is visibly disclosed as part of Markdown export. Automatic GPS, place search, reverse geocoding, and location-to-Gemini transmission remain absent.
- Firestore owner isolation is preserved. Final Rules matrix passed 24/24, including valid location create/update/remove and denial of missing/extra fields, invalid types, out-of-range coordinates, empty labels, and labels over 120 characters.
- Browser key retrieval uses Firebase-authenticated `/api/maps-config`, `Cache-Control: no-store`, generic server errors, and an independent 60/hour per-user limiter. It does not consume the 20/hour Gemini generation limit.
- Unauthenticated endpoint verification returned fixed `401 AUTH_REQUIRED` and did not disclose configuration fields.
- A browser Maps key cannot be made secret after delivery to Maps JavaScript. Required controls remain Websites application restriction, Maps JavaScript API restriction, a dedicated key, quota/usage monitoring, and cautious rotation. The Firebase Web key and Gemini server key must not be reused.
- Source scan found no new credential. Only the existing Firebase Web key and a non-secret Maps placeholder were present; private-key and Bearer-token counts were zero.
- Signed-in Maps interaction was not validated during local implementation because no real key or map ID was available at that time. The subsequent user-reported provisioning checkpoint is recorded below; before deployment, configure runtime secrets, verify allowed production origin and denied origins, test save/reload/remove/export, review usage metrics, and consider Maps JavaScript App Check after the existing monitoring plan is mature.

## Google Maps credential provisioning checkpoint — 2026-09-04

- [x] User reported creating a dedicated production Maps JavaScript browser key: `reflectai-journal-location-prod-web-key`.
- [x] User reported creating a production JavaScript vector Map ID: `reflectai-journal-location-prod-js-vector`.
- [x] Keep the production referrer allowlist limited to `https://reflective-journal-ai-companion.ai.studio/*`; do not mix localhost or `127.0.0.1` into the production key.
- [x] Keep the API restriction limited to Maps JavaScript API; do not add reCAPTCHA Enterprise API, Places, Geocoding, Geolocation, or unrelated Maps APIs to this key.
- [x] No real key value was disclosed to the assistant or written to source, documentation, or logs.
- [ ] Independently verify in Google Cloud Console that Websites and Maps JavaScript API restrictions were saved and are active.
- [ ] Configure `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID` through the deployment runtime secret／environment mechanism without committing either value.
- [ ] Run authenticated allowed-origin and denied-origin QA, then validate pin／save／reload／remove／export and inspect Maps quota／usage telemetry.
- Evidence note: credential and Map ID creation are user-reported external state. No deployment, publication, paid Maps request, or production Firestore write occurred during this documentation checkpoint.

### AI Studio runtime Secrets status — 2026-09-04

- User-reported current state: Maps configuration has now been added to Google AI Studio Secrets under the expected runtime names.
- Secret values were deliberately not inspected or recorded. Documentation contains names, intended restrictions, and verification status only.
- Treat runtime injection as unverified until a signed-in Preview request reaches `/api/maps-config`, returns only the expected bounded shape, loads Maps from the approved origin, and leaves no key value in application logs or source.
- Existing controls remain mandatory despite authenticated retrieval: dedicated browser key, Websites restriction, Maps JavaScript API restriction, quota monitoring, and no Firebase／Gemini key reuse.

## AI Studio location synchronization and Preview boundary — 2026-09-04

- AI Studio source synchronization changed exactly the twelve approved files. Independent View Changes inspection confirmed no change to `package.json`, lockfiles, `Sidebar.tsx`, Firebase configuration, or `metadata.json`.
- Source attachments contained code, placeholders, and documentation only. They did not contain a real Maps key, Map ID value, Gemini key, user journal export, or photograph.
- AI Studio typecheck and production build passed with zero errors. This is compilation evidence only; it does not prove Rules deployment, runtime secret delivery, origin restrictions, Maps loading, or Firestore write authorization in production.
- The build automatically loaded signed-in Preview and performed an owner-scoped Firestore read of the current journal list. No write, deletion, summary/chat request, Rules deployment, or publication was performed. Generated AI Studio text claiming no live read is superseded by the observed Preview state.
- Preview listed the expected Maps environment names but did not show applied values; Apply was disabled. No secret was viewed or entered. Treat runtime secret injection as unresolved until the authenticated picker loads Maps without exposing values in source/logs and the expected `/api/maps-config` behavior is observed.
- Post-sync archive download did not complete through browser automation, so there is no fresh exported artifact or checksum. Manual export plus independent source/hash comparison remains a release gate.
- Firestore Rules remain undeployed. Do not run pin/save/remove against production until the tested Rules revision is deliberately deployed and verified under an explicit deployment approval.

## AI Studio post-sync archive security verification — 2026-09-04

- [x] Manual post-sync archive obtained and normalized to a clear single-`.zip` filename.
- [x] Archive integrity recorded: SHA-256 `1B4CB3DBB1E945FB8DD66D0484C3426393C1AAE5DFC3B6494BF32806EF002A78`, size `298,783 bytes`.
- [x] All twelve approved synchronized files are byte-identical to the locally tested candidate; no unexpected AI Studio-only file was found.
- [x] Whole-export differences are limited to intentional local-only test tooling in `.gitignore`, `package.json`, and seven Emulator/location support files.
- [x] Fresh location tests passed 5／5; fresh demo-project Firestore Emulator Rules tests passed 24／24; frontend and server production builds passed.
- [x] Source/document scan found zero private-key blocks and zero Bearer tokens. `.env.example` uses `MY_*` placeholders and contains no valid Maps/Gemini key. The existing Firebase Web client key remains intentionally client-visible and must retain Console restrictions.
- [ ] Verify authenticated AI Studio Preview receives the expected bounded `/api/maps-config` response and loads Maps from the approved origin without logging secret values.
- [ ] Deploy the independently tested transition-validation Firestore Rules only after explicit approval, then verify the active Rules version before any production location write.
- [ ] Complete signed-in pin／save／reload／remove／Markdown-export and denied-origin QA before Publish.
- Verification tooling note: sandbox and package-manager entry-point failures were not security or product-test failures. No dependency purge was approved or performed; direct project-local test/build executables produced the recorded passing evidence.

## AI Studio Preview Maps runtime gate — 2026-09-04

- [x] Confirm the picker fails closed when Maps runtime configuration is absent; core journaling remained available and `Save Location` remained disabled.
- [x] Confirm the current Preview process received zero environment injections and returned fixed `MAPS_UNAVAILABLE` errors without disclosing configuration values.
- [x] Preserve existing debug logs; no dismiss/clear operation was performed.
- [x] Confirm no secret value, coordinate, Firestore write/delete, Gemini request, Rules deployment, or publication occurred.
- [ ] Apply the already-created `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID` Secrets to the current Preview runtime, then restart/reload Preview without exposing either value.
- [ ] Retry the picker and distinguish successful load from later website/API restriction errors before authorizing any Rules deployment or persistence test.
- Existing App Check Preview warning and Vite HMR websocket errors predated the Maps action and remain separate known Preview noise; they are not evidence that the Maps key was rejected.

## AI Studio Secrets mapping and browser-key handling — 2026-09-04

- [x] Identify the runtime mapping defect: credential display name was used instead of `GOOGLE_MAPS_API_KEY`.
- [x] Identify missing `GOOGLE_MAPS_MAP_ID` row.
- [x] Confirm no secret row was edited, added, deleted, applied, copied, or submitted by automation.
- [!] AI Studio accessibility unexpectedly returned the Maps browser-key field value without an intentional visibility toggle. The value is omitted from all assistant text and project documentation, and Settings was closed immediately.
- [ ] Rotate the Maps browser key after correcting the mapping, then reconfirm Websites and Maps JavaScript API restrictions and quota monitoring. Rotation is credential hygiene; the key remains client-visible by design and is not a server secret.
- [ ] Create or use a separate tightly restricted Preview/dev key for the current `ais-dev-...asia-northeast1.run.app/*` origin. Do not broaden the production key beyond the published app origin merely to make Preview pass.
- [ ] Manually create/apply exact rows `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID`; never paste either value into chat, source, logs, screenshots, or documentation.

## Dedicated Preview Maps key checkpoint — 2026-09-04

- [x] User reported a dedicated Preview browser key rather than broadening or reusing the production key.
- [x] Production Websites restriction remains `https://reflective-journal-ai-companion.ai.studio/*`.
- [x] Preview Websites restriction is limited to the current `https://ais-dev-wwpeecywfneevyhaf6dcuq-656992758307.asia-northeast1.run.app/*` origin.
- [x] Both keys are restricted to Maps JavaScript API only.
- [x] Reuse the existing JavaScript Map ID; no additional Map ID or unrelated API permission is required.
- [x] No key value was placed in chat, source, change logs, or documentation during this configuration report.
- [ ] Apply the Preview key as `GOOGLE_MAPS_API_KEY` and the existing Map ID as `GOOGLE_MAPS_MAP_ID` in AI Studio, then verify runtime delivery and allowed-origin loading.
- [ ] Before publication, replace the Preview key with the production key through the approved runtime mechanism and complete the previously recommended production-key rotation／restriction review.

## Preview Maps load-only security gate — 2026-09-04

- [x] User applied exact AI Studio runtime names and reloaded Preview without sharing values in chat.
- [x] Authenticated picker rendered Google Maps successfully on the restricted Preview origin.
- [x] No `MAPS_UNAVAILABLE`, referrer denial, API-restriction error, loader error, or Map ID error appeared after reload.
- [x] Empty coordinates left `Save Location` disabled; no default or blank value was coerced into `0,0`.
- [x] Picker was closed without selecting/transmitting a precise location, writing/deleting Firestore data, invoking Gemini, deploying Rules, or publishing.
- [x] Remaining console warning is the known AI Studio Preview App Check reCAPTCHA warning and is not classified as a Maps failure.
- [ ] Obtain explicit deployment approval, deploy the independently tested transition-validation Firestore Rules, and verify the active version before location persistence E2E.
- [ ] After Rules verification, run pin／save／reload／remove／Markdown-export QA with a clearly synthetic test point and remove the test location afterward.

## Location-aware Firestore Rules production deployment — 2026-09-04

- [x] Received explicit user authorization before changing production Rules.
- [x] Re-ran automated Firestore Emulator coverage: `24 passed / 0 failed`; expected deny-path `PERMISSION_DENIED` logs confirm rejection behavior.
- [x] Corrected the local deployment target by adding named database `ai-studio-d82d6296-0049-4433-955f-91f203831d05` to `firebase.json`, avoiding accidental reliance on `(default)`.
- [x] Completed user-controlled Firebase CLI OAuth after the unauthenticated deployment failed closed. Authenticated identity reported by the CLI: `jimmy880625@gmail.com`.
- [x] Deployed only the configured Firestore resource to `jimmy-gemini-journal`; CLI confirmed successful compilation, upload, rules release, and deployment completion.
- [x] Recorded deployed source integrity: SHA-256 `5BF26D72193716A62971ADB1AF7156F116E3C9368917D8A00484F37597715A94`.
- [x] No Hosting／Functions deployment, AI Studio Publish, secret disclosure, Gemini call, or Firestore document mutation occurred.
- [ ] After propagation, complete location persistence E2E with synthetic coordinates and remove the test location; verify owner isolation remains intact in the live app.

## User-operated location persistence verification — 2026-09-04

- [x] User reported successful Preview pin and save after Rules deployment.
- [x] User reported that reload preserved and displayed the saved location.
- [x] User reported successful removal; the synthetic location is no longer attached to the entry.
- [x] No credential value was shared during this flow.
- [ ] Verify removed-state Markdown export omits label, coordinates, and Google Maps URL.
- [ ] Temporarily pin a synthetic point, verify Markdown export includes the expected location fields, then remove it again.

## Removed-state Markdown export privacy check — 2026-09-04

- [x] `.md` downloaded and renamed successfully by the user.
- [x] Location heading occurrence count: `0`.
- [x] Former location label occurrence count: `0`.
- [x] Google Maps search URL occurrence count: `0`.
- [x] Private journal export remained local and was not shared with the assistant.
- [ ] Complete the positive synthetic-location export check, then remove the point again.

## Positive Markdown export and cleanup security gate — 2026-09-04

- [x] Location heading appeared exactly once.
- [x] Synthetic label appeared exactly once.
- [x] Expected bounded coordinates appeared exactly once.
- [x] Google Maps URL opened the intended public landmark.
- [x] No Maps API key, Map ID, Firebase token, or other credential was found in the export.
- [x] User removed the synthetic point and reloaded; no location remained attached to the entry.
- [x] Private Markdown content remained under user control and was not supplied to the assistant.
- [x] Preview persistence／export security gate is complete.
- [ ] Publish only after separate explicit approval and ensure production runtime uses the production-restricted Maps key rather than the Preview key.

## Production Maps credential transition gate — 2026-09-04

- [x] User re-confirmed Websites restriction: `https://reflective-journal-ai-companion.ai.studio/*` only.
- [x] User re-confirmed API restriction: Maps JavaScript API only.
- [x] `GOOGLE_MAPS_API_KEY` now references the production key rather than the Preview key.
- [x] Existing `GOOGLE_MAPS_MAP_ID` retained and reported correct.
- [x] User clicked `Apply`; no secret value was disclosed to the assistant or committed to source.
- [x] Transient Preview origin remains excluded from the production key; any resulting Preview denial is expected and must not trigger allowlist widening.
- [ ] Obtain explicit publication approval, Publish, then run production load-only and synthetic persistence／cleanup smoke tests.

## Cloud Firestore App Check pre-publish confirmation — 2026-09-04

- [x] User confirmed Cloud Firestore App Check is currently unenforced in `Security → App Check → APIs`.
- [x] No Enforce action, provider edit, key/domain change, or threshold adjustment occurred.
- [x] Existing reCAPTCHA Enterprise registration and client token-refresh wiring remain the configured monitoring path.
- [ ] After publication, generate legitimate production traffic, review Verified／Unverified metrics, and obtain separate approval before enforcement.

## Published location release and snapshot security gate — 2026-09-04

- [x] Explicit publication authorization was obtained; the user manually clicked `Publish your app`.
- [x] AI Studio reported the app as published and `Ready` at `https://reflective-journal-ai-companion.ai.studio/`.
- [x] Published description documents explicit location confirmation, Google Maps linking, Gemini exclusion, owner isolation, and non-clinical scope.
- [x] Production key remained origin-restricted and Maps-JavaScript-only; no credential value was exposed, copied, or stored in source／documentation.
- [x] Assistant did not invoke `Republish`／`Unpublish`, open Secrets, change App Check enforcement, or mutate journal data.
- [x] Failed automated download was handled fail-closed: timeout plus absence of a new ZIP was recorded, then control was handed to the user instead of claiming success.
- [x] Post-publish archive verified: 298,783 bytes; SHA-256 `2153AD672833B9B8776AF723ABA9C7B747611A5CC6F22B92B23F2F02B9415798`; 37 entries／29 files；0 unsafe paths.
- [x] All 29 extracted file-content hashes match the verified pre-publish source snapshot; no source drift occurred during publication.
- [ ] Run production signed-in map load and synthetic pin／save／reload／remove cleanup smoke tests.
- [ ] Review production App Check Verified／Unverified metrics and obtain separate approval before any enforcement change.

## Production load-only location security gate — 2026-09-04

- [x] Production authentication succeeded.
- [x] Owner-scoped journal list loaded normally.
- [x] Google Maps rendered successfully on the production-restricted origin.
- [x] `Save Location` remained disabled before coordinate selection.
- [x] No coordinate, Firestore mutation, Gemini request, secret change, App Check enforcement, or republish occurred.
- [ ] Pin and save a non-sensitive public-landmark test point, then reload and verify exact persistence.
- [ ] Remove the test point, reload, and verify final cleanup before closing the production smoke gate.

## Production location-write security gate — 2026-09-04

- [x] A non-sensitive public-landmark synthetic point was used instead of a private home／work location.
- [x] Marker and coordinates appeared correctly after explicit selection.
- [x] `Save Location` became enabled only after valid coordinates existed.
- [x] Production Firestore save succeeded under the deployed owner-scoped Rules.
- [x] Saved label, coordinates, and Google Maps link rendered correctly; no permission or validation error was reported.
- [x] No Gemini request, credential exposure, configuration change, App Check enforcement, or republish occurred.
- [ ] Reload and verify that the exact synthetic location persists.
- [ ] Remove it, reload again, and confirm the final location-free state.

## Production reload-persistence security gate — 2026-09-04

- [x] Reload preserved the synthetic location in the same owner-scoped journal.
- [x] Label and coordinates remained unchanged rather than becoming blank, `0,0`, or a different point.
- [x] Google Maps link continued to resolve to the correct public landmark.
- [x] No authentication, Firestore-read, Maps, or rendering error was reported.
- [x] No Gemini call, secret exposure, configuration change, enforcement change, deployment, or republish occurred.
- [ ] Remove the temporary synthetic point and reload once more.
- [ ] Confirm that location UI, label, coordinates, and Maps link remain absent after reload.

## Production location cleanup and release security gate — 2026-09-04

- [x] `Remove Location` succeeded under the deployed owner-scoped Rules.
- [x] Location UI, synthetic label, coordinates, and Google Maps link disappeared immediately.
- [x] Final reload preserved the location-free state.
- [x] Existing journal content remained normal and no authentication, Firestore, Maps, rendering, or validation error was reported.
- [x] No synthetic production QA location remains.
- [x] Full production location smoke path passed from sign-in through final cleanup.
- [x] Assistant did not inspect private journal text or exact coordinates; no Gemini call, credential exposure, source／configuration change, App Check enforcement, deployment, or republish occurred.
- [ ] Observe production App Check Verified／Unverified metrics over legitimate traffic.
- [ ] Keep Firestore enforcement disabled until metrics are acceptable and a separate enforcement approval is obtained.

## Cloud Firestore App Check 24-hour metrics gate — 2026-09-04

- [x] Reviewed Cloud Firestore App Check metrics without changing enforcement.
- [x] Total requests: `81`.
- [x] Verified: `50／81`（62%）.
- [x] Outdated client: `0／81`.
- [x] Unknown origin: `0／81`.
- [!] Invalid: `31／81`（38%）.
- [x] Enforcement remains monitoring-only／unenforced.
- [x] Do not enforce at the current ratio; invalid-token traffic would be rejected.
- [ ] Isolate production-only traffic by closing Preview／local clients and generating a small legitimate read sample.
- [ ] Recheck a shorter recent metrics window after propagation and investigate whether invalid requests continue.
- [ ] Require a separate explicit approval even after metrics become acceptable; no automatic enforcement transition is authorized.

## Production-only App Check delta gate — 2026-09-04

- [x] Closed Preview／local clients before generating a small production read-only sample.
- [x] Baseline: Total `81`、Verified `50`、Invalid `31`.
- [x] Follow-up: Total `84`、Verified `51`、Invalid `33`；Outdated `0`、Unknown origin `0`.
- [!] Increment: `3` total、`1` Verified、`2` Invalid.
- [x] No enforcement or App Check configuration change was made.
- [x] Do not treat historical Preview traffic as a sufficient explanation for all invalid requests.
- [ ] Pause repeated traffic tests and inspect App Check initialization order, Firebase web-app／reCAPTCHA Enterprise registration, and the public production bundle.
- [ ] Keep enforcement off until a later isolated sample is overwhelmingly Verified and separate approval is obtained.

## App Check client and production-asset inspection — 2026-09-04

- [x] Confirmed `initializeAppCheck` precedes Auth and named-database Firestore initialization.
- [x] Confirmed `ReCaptchaEnterpriseProvider` and automatic token refresh are configured in the published snapshot.
- [x] Confirmed production loads `index-Bb7MtKAH.js` and reCAPTCHA Enterprise runtime scripts.
- [x] Background production console inspection returned zero warning／error entries.
- [!] Direct no-cache bundle retrieval failed in the local TLS／authentication layer; no bundle artifact was created. Browser page-asset inventory provided the fallback evidence.
- [x] No source, Firebase, Google Cloud, App Check enforcement, or publication change occurred.
- [ ] Verify that Firebase App Check registration maps the correct web app to the same reCAPTCHA Enterprise key used by the bundle.
- [ ] Verify a score-based Web key whose allowed domain is the bare hostname `reflective-journal-ai-companion.ai.studio`, without scheme／path／port, and with allow-all-domains disabled.
- [ ] Do not alter registration or key settings without separate explicit approval.

## Firebase App Check Web registration identity gate — 2026-09-04

- [x] Exactly one Firebase Web app exists in project settings.
- [x] Firebase App ID suffix `675f3232` matches the published snapshot.
- [x] App Check reports the Web app as Registered.
- [x] Provider is `reCAPTCHA Enterprise`.
- [x] No registration, provider, enforcement, or publication change occurred.
- [ ] Verify the registered site key is the same key embedded in the published app configuration.
- [ ] Verify Google Cloud Web-key integration type and allowed production hostname before considering remediation.

## reCAPTCHA Enterprise key configuration gate — 2026-09-04

- [x] Exactly one relevant key exists: `reflective-journal-app-check`.
- [x] Key ID suffix matches the published `recaptchaSiteKey` suffix `RcNu5e`; full key is omitted.
- [x] Key type is Website／Score and not Checkbox.
- [x] Allowed-domain list contains only `reflective-journal-ai-companion.ai.studio` in bare-hostname format.
- [x] Domain verification is enabled (`Disable domain verification` is off).
- [x] AMP allowance is off.
- [x] No code, key, domain, registration, enforcement, or publication setting changed.
- [ ] Generate a small read-only sample in ordinary Chrome, not the Codex in-app browser, then compare App Check metric deltas.
- [ ] Do not remediate or enforce until browser-environment attribution is resolved.

## Ordinary Chrome App Check isolation gate — 2026-09-04

- [x] Pre-test: Total `102`、Verified `67`、Invalid `35`、Outdated `0`、Unknown origin `0`.
- [x] Post-test: Total `104`、Verified `69`、Invalid `35`、Outdated `0`、Unknown origin `0`.
- [x] Increment was `2／2` Verified and `0` Invalid.
- [x] Normal Chrome production traffic is App Check-valid.
- [x] Source, Firebase registration, site-key mapping, key type, and domain settings require no remediation based on current evidence.
- [x] Avoid using Codex in-app／embedded browser traffic as production enforcement-readiness evidence.
- [x] No code, credential, domain, registration, enforcement, deployment, or publication setting changed.
- [ ] Keep Cloud Firestore enforcement off while the 35 historical Invalid requests remain in the 24-hour window.
- [ ] Recheck recent normal-browser metrics after historical traffic ages out and obtain separate explicit approval before enforcement.

## RBAC and external-notification security gate — 2026-09-04

- [x] Roles are signed Firebase Custom Claims and are enforced again on the backend after full ID Token validation.
- [x] `owner` is fail-closed behind both the signed claim and an environment `OWNER_UIDS` allowlist.
- [x] Admins cannot grant roles; owners cannot change themselves through the endpoint; `owner` cannot be granted or revoked through the normal admin flow.
- [x] Role changes require recent authentication, exact confirmation text, bounded reason, verified target email, idempotency, and a server-only audit record.
- [x] AI is advisory-only. Its instruction forbids authorization, execution, bypasses, credentials, tokens, recovery codes, private journals, and notification secrets.
- [x] Admin overview exposes configuration status only and has no raw-journal read path.
- [x] Client access to `_adminAudit` and `_notificationEvents` is denied by Firestore Rules.
- [x] External notifications are disabled by default and require explicit, revocable consent.
- [x] Security rationale recorded: an external message becomes a separate copy controlled by Gmail／Slack／Discord retention, membership, forwarding, and access policies. Opt-in preserves user agency; minimal payloads reduce breach impact and accidental disclosure.
- [x] External payload excludes journal text, summary text, title, tags, mood, location, crisis wording, Firebase UID, email address, tokens, API keys, and webhook URLs. It carries only a generic event label and app sign-in URL.
- [x] Crisis detection is not an allowed external notification event. Gmail／Slack／Discord are not emergency services and are not used for automatic escalation.
- [x] Gmail uses OAuth 2.0 `gmail.send` rather than a password or App Password; refresh token and client secret are server-only placeholders pending Secret Manager configuration.
- [x] Slack／Discord webhooks require HTTPS, exact approved hosts and webhook paths, and reject redirects.
- [x] Delivery requests have a separate rate limiter, idempotency record, bounded timeout, generic errors, and no credential logging.
- [x] Country-aware crisis resources are deterministic and user-selected; GPS, IP geolocation, pinned location, and Gemini inference are excluded.
- [x] India priority resources were verified against Government of India sources: emergency `112`; Tele-MANAS `14416` or `1800-89-14416`. Taiwan resources remain available; EU uses official `112`; unknown regions use a global directory fallback.
- [x] Automatic dialing and silent trusted-contact notification were rejected. A future trusted-contact feature must be separately approved, explicit, user-initiated, and confirmed by the device dialer.
- [x] TypeScript pass; `13／13` security unit tests; `5／5` location tests; `30／30` Firestore Emulator tests; frontend／server production build pass; final production audit has no known vulnerabilities.
- [x] The first audit exposed one moderate transitive `uuid` advisory; the first package-level override did not affect pnpm. A precise workspace override resolved vulnerable `uuid 9.0.1` paths to patched `11.1.1`.
- [!] Two sandboxed builds failed only because esbuild could not read a dependency ancestor path; approved unsandboxed build passed. Keep this error in evidence and do not classify it as a source failure.
- [ ] Configure Firebase Admin SDK IAM with least privilege and verify named-database routing in a non-production test environment.
- [ ] Bootstrap exactly one owner only after explicit approval; do not run either role command automatically.
- [ ] Configure Google OAuth consent and store Gmail OAuth credentials in Secret Manager. If the OAuth app remains in external Testing status, verify refresh-token lifetime before relying on unattended delivery.
- [ ] Decide whether Slack／Discord V1 uses a clearly disclosed app-owned channel or a later per-user OAuth connection. Current adapter supports only app-owned server-side webhooks.
- [ ] Perform signed-in UI, negative-path API, notification delivery, token-refresh, and role-change E2E tests without sharing credentials or tokens.
- [ ] Deploy revised Rules and publish only after separate approval. App Check enforcement remains unchanged and unenforced.
- [x] Source-only package contains 49 entries and 0 unsafe paths; SHA-256 `F0C525FD7127E6FEA8DACEC1C47F3C1D32072D14E7817513086A984C0C56A4E4`. It excludes dependencies, build output, Firebase CLI config, emulator logs, and credentials.

## AI Studio hybrid-source synchronization gate — 2026-09-04

- [x] Confirmed the signed-in Firebase CLI account can see ACTIVE project `jimmy-gemini-journal`; no cloud mutation occurred.
- [x] Downloaded the current AI Studio app only for baseline comparison; no code, Secret, permission, sharing, publish, or deployment action occurred.
- [x] Excluded `node_modules`, build output, Firebase CLI state, and emulator logs after the first whole-tree diff hit an unreadable dependency path.
- [x] Verified the later AI Studio `Sidebar.tsx` change is already present byte-for-byte in the local candidate; it will not be overwritten by an older local copy.
- [x] Identified the intended local delta without reading or exporting any real Secret value. Environment files contain placeholders only.
- [ ] Before upload, create a minimal source package that excludes `.firebase-config`, `firestore-debug.log`, dependencies, build output, credentials, and unrelated local tooling.
- [ ] AI Studio must typecheck and build the merged revision before any publication or Firestore Rules deployment.
- [ ] Do not create OAuth credentials, configure Secret values, bootstrap an owner, deploy Rules, or publish without reaching the corresponding explicit approval boundary.
- [x] Prepared a 17-file minimal runtime／configuration payload plus one instruction file; excluded dependencies, build artifacts, CLI state, emulator logs, tests, local lockfiles, credentials, and unchanged `Sidebar.tsx`.
- [x] Corrected payload secret scan passed with no private-key, Google token, Slack token／webhook, or Discord webhook match. The first scan invocation was invalid because its leading-hyphen pattern was parsed as a command option and was not treated as evidence.
- [ ] Upload and submit the reviewed payload only after the user confirms the specific AI Studio transmission and code-edit action.

## AI Studio synchronization access gate — 2026-09-05

- [x] User explicitly authorized upload and an unpublished AI Studio code-edit request.
- [x] Automated multi-file and single-file uploads were rejected with `Not allowed`; UI verification showed zero attached files and zero edits.
- [x] Output payload copy contains the same 18 files and has zero SHA-256 mismatch against the scanned work copy.
- [x] Full, retried, clean-chat, reduced-scope, Gemini 3.8 Flash, and Gemini 3.6 Flash requests all failed before edits. Console root evidence is `RpcError: The caller does not have permission`.
- [x] Did not misclassify the permission failure as quota exhaustion; no `429 RESOURCE_EXHAUSTED` evidence was present.
- [x] Did not select the upgrade dialog's pay-per-request or monthly subscription option. No billing or persistent API access was created or bound.
- [x] No source, Secret, credential, role, IAM, Firestore data, Rule deployment, sharing, deployment, or publication change occurred.
- [ ] User must manually upload the reviewed attachments, or separately authorize and complete a paid-access／API-key route, before AI Studio synchronization can continue.

## AI Studio chat-model restoration gate — 2026-09-05

- [x] Restored the editing assistant to `Default (Gemini 3.8 Flash)` exactly as requested and verified the displayed Settings value.
- [x] Did not submit another prompt or use Retry after restoration.
- [x] Did not bind an API key, choose billing, change the runtime model, inspect Secrets, edit source, deploy Rules, change sharing, deploy, or publish.
- [!] Closing Settings briefly returned a detached-node UI error; fresh observation confirmed the panel was already closed and no state-changing retry was necessary.

## Environment-variable persistence gate — 2026-09-05

- [x] Classified `BOOTSTRAP_OWNER_UID`, `BOOTSTRAP_OWNER_CONFIRMATION`, and every `ROLE_*` variable as one-time CLI inputs; prohibit persistence in AI Studio／Cloud Run Secrets.
- [x] Classified `FIRESTORE_DATABASE_ID` as non-secret and optional because the exact named-database default is already compiled into the server-only Admin helper.
- [x] Keep `OWNER_UIDS` unset until a separately approved owner-bootstrap step; owner-only mutations therefore fail closed.
- [x] Keep Slack／Discord／Gmail credentials unset until the integrations are deliberately provisioned; no placeholder or fabricated credential may be saved.
- [x] Absence of these optional values must not block typecheck or build. Runtime overview may report integrations unconfigured.
- [ ] Revise `.env.example` handling in the AI Studio step so optional／CLI-only documentation is not interpreted as a request to create persistent Secrets.

## AI Studio synchronized-archive security gate — 2026-09-05

- [x] Verified archive integrity and safe extraction: 46 entries, zero unsafe paths, SHA-256 `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`.
- [x] Verified every approved synchronization target byte-for-byte: `17／17` matched the scanned upload payload.
- [x] Verified zero out-of-scope source/configuration changes against the pre-sync AI Studio baseline; `Sidebar.tsx`, `bun.lock`, Firebase app identity, and metadata remained unchanged.
- [x] Secret scan covered 37 source/configuration files. No private key, OAuth token, Gmail client secret, Slack webhook, or Discord webhook was found. The Firebase Web API key match is expected public client configuration and is not treated as a server secret.
- [x] Optional privileged and delivery configuration remained unset. No owner was bootstrapped, no role changed, no notification was sent, and no live Firestore／Rules／publish action occurred.
- [x] TypeScript passed independently with zero errors. Production frontend and server builds passed outside the sandbox; the earlier build failure was reproduced as a sandbox directory-access restriction, not a source defect.
- [!] Local `pnpm` installation required explicit build-script allowance; optional `re2` native setup logged a fallback failure because `npm` was unavailable and AppData was restricted. Application typecheck/build still passed.
- [!] Dependency audit remains open. A verification-only pnpm resolution reported one moderate transitive `uuid 9.0.1` advisory, but the archive is governed by `bun.lock`; this is not accepted as proof of the archive's effective Bun dependency state.
- [ ] Manually rerun dependency audit with the same supported Bun version/toolchain used by AI Studio, preserve the existing archive, and capture the resolved `uuid` version plus audit output. Do not add a live secret, deploy, or publish as part of that check.

### Manual Bun prerequisite — 2026-09-05

- [x] Performed a read-only user-operated `bun --version` check before running any package command.
- [!] PowerShell reported that `bun` is not recognized; Bun is absent or not present on the user `PATH`.
- [x] Stopped at the failure boundary. No automated installation, alternate package mutation, audit retry, Secret access, role operation, deployment, or publication occurred.
- [ ] Install Bun only from its official Windows distribution, open a fresh terminal, and verify the reported version before accessing the extracted project.

## Billing-change guardrail — 2026-09-05

- [x] Created an alerts-only Free Trial budget before changing the project's Billing Account.
- [x] Custom period matches the remaining credit window：2026-09-05 through 2026-10-14.
- [x] Added actual-spend warnings at TWD 300／1,000／3,000 against a TWD 3,000 specified target.
- [x] Excluded only promotional credits from budget measurement so Free Trial consumption remains observable; the promotional credit itself remains active and automatically applicable to eligible charges.
- [x] Kept Free Tier and six other normal savings categories included.
- [x] No enforced spend cap, automatic billing disablement, Monitoring channel, Pub/Sub topic, source change, Secret change, deployment, or publication was introduced.
- [!] Budget creation is confirmed from the list row; receipt of a threshold email is not yet testable because tracked spend is TWD 0.

### Direct Billing Account change — 2026-09-05

- [x] Verified exact Project ID `jimmy-gemini-journal` before the user-operated change.
- [x] Pre-change source account was `Jimmy`; selected target was `My Billing Account`.
- [x] Dialog showed no service-interruption, permission, or billing-disabled warning.
- [x] Used direct `Change billing`／`Set account`; did not disable billing first.
- [x] Console returned a successful project-moved message.
- [x] No source, credential, role, Firestore Rule, project data, deployment, sharing, or publication change accompanied the billing operation.
- [ ] Read back the project-to-Billing-Account association and confirm Firebase remains Blaze before runtime smoke testing.

### Billing association read-back — 2026-09-05

- [x] `My projects` showed exact Project ID `jimmy-gemini-journal` linked to `My Billing Account`／`我的帳單帳戶`.
- [x] No disabled, pending, error, lock, or warning state was reported.
- [x] Direct Billing Account reassociation gate is complete.
- [ ] Confirm Firebase pricing remains Blaze before starting service smoke tests.

### Firebase billing continuity — 2026-09-05

- [x] Confirmed project `jimmy-gemini-journal` remains `Blaze／Pay as you go` after Billing Account reassociation.
- [x] No billing error, relink request, or service restriction was displayed.
- [x] Verification was read-only; no pricing, data, Rule, credential, deployment, or publication mutation occurred.
- [ ] Run minimal post-change production smoke checks in ordinary Chrome：published app load, authenticated Firestore read, Cloud Run Maps-config path, and Maps rendering without a data write.

### Post-change production read smoke — 2026-09-05

- [x] Ordinary-Chrome published-app rendering passed.
- [x] Authentication and owner-scoped journal-list／existing-journal Firestore reads passed.
- [x] No Firestore permission, billing, authentication, App Check, or network error appeared.
- [x] No journal／location mutation and no Gemini request occurred.
- [ ] Verify the authenticated Cloud Run Maps-config path and Google Maps rendering without selecting or saving a point.

### Post-change Cloud Run／Maps smoke — 2026-09-05

- [x] Authenticated Cloud Run Maps-config delivery passed.
- [x] Google Maps tiles and controls rendered without configuration, key, referrer, billing, or network error.
- [x] `Save Location` remained disabled while no point was selected.
- [x] Picker closed without selection or save; journal remained location-free after reopen.
- [x] No Firestore write／delete and no Gemini request occurred.
- [x] Post-billing-change production runtime smoke gate is complete.
- [ ] After billing-report latency, verify eligible Cloud Run／Firestore／Maps charges receive the Free Trial promotional credit; do not infer attribution from the current TWD 0 budget row.

### Reminder scheduling failure — 2026-09-05

- [!] Codex scheduler rejected both requested timezone-anchored one-time reminders because of local-time-to-UTC conversion handling.
- [x] Confirmed no automation was created and no duplicate／partial schedule exists from these attempts.
- [x] Stopped after failure; did not retry with alternate semantics or change Billing／cloud／source state.
- [ ] Create the Billing Reports and Free Trial expiry reminders manually in a calendar explicitly configured for Asia／Taipei.

## Challenge submission timing gate — 2026-09-05

- [x] Converted the user-provided deadline from `2026-09-07 02:29 IST` to `2026-09-07 04:59 Asia/Taipei`.
- [x] Established a planning internal deadline of `2026-09-06 18:00 Asia/Taipei`; this is not the official portal deadline.
- [x] Identified mandatory public artifacts and verification metadata from the screenshots and official Codelab.
- [!] Public repository publication requires a fresh secret／license scan before sharing; no repository is assumed public yet.
- [!] Cloud Run label presence and public Gemini flow still require verification before the entry is represented as eligible.
- [x] No submission, social post, repo publication, Cloud Run mutation, deployment, or credential exposure occurred during deadline planning.
- [x] A documentation patch context mismatch failed atomically with no partial file change; retry used current file text only.

## Submission release safety rule — 2026-09-05

- [x] User created four manual Calendar milestones in Asia／Taipei, including an internal deadline nearly eleven hours before the portal closes.
- [x] Treat RBAC／notification／regional-safety publication as conditional on Preview plus production verification.
- [x] Preserve the already verified location-enabled production release as fallback; do not sacrifice authentication, Firestore isolation, Maps, or uptime merely to add judging scope.
- [x] Keep owner bootstrap and external-delivery credentials separately gated; disabled／fail-closed integrations may not be described as live delivery.
- [x] Read-only verification completed for Cloud Run label `dev-tutorial=cloud-run-ai-challenge`；no label mutation was necessary.

## Cloud Run challenge metadata verification — 2026-09-05

- [x] Verified exact service `reflective-gemini-journal-companion` and region `us-west1`；service health is normal.
- [x] Verified required automated-eligibility label exactly：key `dev-tutorial`, value `cloud-run-ai-challenge`.
- [x] Verified Cloud Run endpoint configuration lists custom domain `reflective-journal-ai-companion.ai.studio`, establishing the published-app-to-service mapping.
- [x] Preserved read-only scope：no label update, new revision, traffic change, credential access, deploy, or publish occurred.
- [!] Two documentation patch attempts failed atomically on stale context；no partial document change occurred before the corrected per-file update.
- [x] Copied both enabled default HTTPS hostnames without Console truncation；no query parameters or authentication data were recorded.
- [x] Endpoint 1：`reflective-gemini-journal-companion-516107960247.us-west1.run.app`.
- [x] Endpoint 2：`reflective-gemini-journal-companion-ktotj325za-uw.a.run.app`.
- [!] First combined documentation update failed atomically on a CONTEXT mismatch；the corrected update was applied per file.
- [x] Opened endpoint 1 in a fresh signed-out／incognito window；the landing page rendered on the same hostname.
- [x] No Cloud Run IAM `403`, `404`, `5xx`, TLS／certificate warning, blank page, or redirect loop appeared.
- [x] Endpoint 1 passes the public-access gate for challenge-form use.
- [x] Verified custom domain `reflective-journal-ai-companion.ai.studio` in the same signed-out／incognito context.
- [x] Landing page rendered on the same hostname without `403`, `404`, `5xx`, TLS／certificate warning, blank page, or redirect loop.
- [x] Canonical Cloud Run URL and human-facing custom domain both pass public-access eligibility.
- [ ] Before candidate publication, perform signed-in AI Studio Preview QA for RBAC, notification settings, and user-selected safety region while privileged／delivery configuration remains unset and fail closed.
- [x] Normal-user Preview RBAC visibility passed：Notifications and Safety resources visible；Administration hidden；no error reported.
- [!] Responsive release blocker：the viewport-fixed notification／safety group overlaps Markdown export at current screen size and the title editor in Mobile portrait.
- [x] Direct read-only visual／geometry evidence confirmed about 41 px overlap between Notification and Export at current screen size.
- [x] Tablet portrait／landscape and Mobile landscape passed by user report.
- [ ] Replace the independent viewport-fixed placement with responsive, collision-free placement integrated into or reserving space for the journal header；then retest all reported device modes before Publish.
- [x] Directly observed Mobile portrait at `375 × 667` and confirmed both global controls overlap the title input：about 41 px per button, spanning roughly the title's final 90 px.
- [x] Observation was read-only；no field input, preference write, notification dispatch, role operation, deploy, or publish occurred.
- [ ] Deadline-safe remediation candidate：reserve approximately 96 px beside the title on sub-`xl` layouts and beside the action row on `xl` layouts, then visually verify that the title remains editable and export remains clickable without introducing toolbar wrapping defects.
- [x] Implemented responsive 96 px reservation locally in `JournalEditor.tsx` only：title row below `xl`；action row at `xl` and above.
- [x] TypeScript typecheck passed with zero errors.
- [x] Production build is verified after the edit：the user-operated retry completed both Vite and esbuild successfully.
- [x] Stopped automatic retries after the build failure and switched to manual guidance as required.
- [x] Ran the production build manually outside the sandbox；Vite transformed `2271` modules and esbuild emitted `dist/server.cjs` plus its source map.
- [ ] After successful build, sync the exact changed source and repeat current-screen, Mobile portrait／landscape, Tablet portrait／landscape, and export clickability QA.
- [x] Distinguished the Sidebar `Shield` isolation-status icon from the separate `ShieldCheck` Administration action.
- [x] Confirmed Administration visibility remains role-gated to `admin／owner`；its absence for the current normal user is a security pass.
- [x] Inventoried nine matching project ZIPs in Downloads without recursive traversal or mutation.
- [x] Verified the latest Downloads／outputs duplicate is byte-identical by SHA-256 `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`.
- [x] Deferred all move／overwrite decisions until an exact destination is confirmed.
- [!] First combined documentation patch failed atomically on stale context；no partial edit occurred.
- [x] Read-only validated proposed D-drive archive destination：ample free space；target directory not yet created.
- [x] Recommended a dated archive leaf to avoid mixing historical ZIP exports with active working source.
- [x] Confirmed manual movement of Downloads ZIPs will not change the current build workspace.
- [ ] User manually creates the destination tree and moves only the nine identified project ZIPs；verify source absence and destination presence before continuing.
- [x] User manually completed the move；verified zero matching ZIPs remain in Downloads and exactly nine are present in the dated archive leaf.
- [x] Latest ZIP hash remained `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280` after movement.
- [x] Corrected path interpretation from nonexistent `Computing\_Lessons` segments to actual single folder `Computing_Lessons`.
- [x] Left two pre-existing `myproject zip files` archives untouched and outside the nine-file move count.
- [!] User-shell `pnpm run build` did not start because `pnpm` is absent from PATH.
- [x] No install, dependency resolution, lockfile mutation, build artifact, deploy, or publish occurred.
- [x] Manual fallback remains active；do not install package managers merely to satisfy this check.
- [ ] Check existing `node --version` and `npm --version` only. If both are available, use `npm run build` with the existing project dependencies.
- [!] User-shell `node --version` also failed because Node is absent from PATH；npm check was intentionally skipped.
- [x] Located pre-existing Codex bundled Node 24.19.0 and a self-contained pnpm wrapper without installing or changing PATH.
- [x] Inspected the wrapper：it calls only the adjacent bundled Node／pnpm module and forwards arguments.
- [ ] User manually runs the absolute wrapper with `--version` first；build remains paused until that read-only prerequisite passes.
- [x] Absolute bundled wrapper version check passed：`pnpm 11.19.0`.
- [x] No installation or PATH mutation was required.
- [!] First documentation patch wrapper had a parse error before patch execution；no partial edit occurred.
- [ ] Run production build from the exact candidate directory using the same absolute wrapper；stop and report the full output on any failure.
- [!] Absolute wrapper reached the package script, but Vite's child command could not resolve `node` from the user-shell PATH；build exited 1 before compilation.
- [x] No install, lockfile／dependency mutation, successful artifact, deploy, or publish occurred.
- [ ] Temporarily prepend the bundled Node `bin` only to the current PowerShell process PATH；verify Node 24.19.0 before retrying.
- [x] Do not write a User／Machine PATH value；closing the shell must remove the temporary setting.
- [x] Process-local PATH check passed：`node v24.19.0`.
- [x] No persistent environment-variable or software-installation change occurred.
- [x] Retried the production build in the same PowerShell process；completed with exit success and no TypeScript／bundling error.
- [x] Corrected a read-only compiled-CSS probe whose regex escaping initially produced false negatives for `xl` selectors；literal inspection confirmed `pr-24`, `xl:pr-0`, and `xl:pr-24` are emitted.
- [!] Vite reported one minified JavaScript chunk at `1,246.10 kB`, above its `500 kB` advisory threshold. This is tracked as non-blocking performance debt；avoid deadline-risky bundler restructuring before functional submission gates finish.
- [x] No secret, environment credential, dependency, lockfile, persistent PATH, role, notification, Firestore, deploy, or Publish mutation occurred during build verification.
- [ ] Synchronize only the exact responsive `JournalEditor.tsx` revision into AI Studio and complete all responsive／interaction regression checks before Publish.
- [!] First AI Studio synchronization attempt received no attachment or pasted source；Gemini stopped without changing any file.
- [x] Fail-safe behavior passed：zero inferred edits, installs, settings changes, credentials, role actions, notifications, Firestore operations, deployments, or publication.
- [x] Unchanged AI Studio baseline passed typecheck and production build；do not misattribute these results to the unsynchronized responsive revision.
- [ ] Manually attach `JournalEditor.tsx`, confirm its visible filename／attachment chip before submission, then request the same one-file replacement and validation.
- [x] Second synchronization received the attachment and changed exactly `src/components/JournalEditor.tsx`；responsive classes were retained.
- [!] AI Studio replacement result mutated line 489 to undefined `errorDataCode(errData)`；`tsc --noEmit` failed with `TS2304` and exit code 2.
- [x] Gemini stopped without unauthorized repair, install, configuration change, credential action, data access, deploy, or Publish.
- [x] Verified local attachment line 489 remains `const code = typeof errData?.code === 'string' ? errData.code : '';` and contains no `errorDataCode` identifier.
- [x] Fresh local typecheck passed with zero errors, isolating the mismatch to the AI Studio copy.
- [!] AI Studio build success does not clear the failed typecheck because Vite／esbuild can transpile without semantic TypeScript checking.
- [!] An unrelated read-only Bun-version probe referenced a nonexistent executable path and failed before execution；no state changed, and no Bun fallback was attempted.
- [ ] Restore only line 489 in AI Studio to the exact local expression, verify the changed-file list remains one file, then rerun typecheck and production build before responsive QA.
- [x] User manually restored AI Studio line 489 to the exact `errData.code` expression and saved the file.
- [!] AI Studio search was unavailable；zero `errorDataCode` occurrences and continued presence of both responsive class strings remain unverified.
- [ ] Run a strictly read-only Gemini source inspection, TypeScript typecheck, and production build. Any file edit during this pass invalidates the verification.
- [ ] Do not Publish until `errorDataCode = 0`, both responsive class strings are present, typecheck passes, and build passes.
- [x] Read-only AI Studio inspection confirmed `errorDataCode` count 0 and the exact valid `errData.code` expression at line 489.
- [x] Confirmed `pr-24 xl:pr-0` at line 606 and `xl:pr-24` at line 638.
- [x] AI Studio TypeScript typecheck passed with exit 0, zero errors, and zero warnings.
- [x] AI Studio production build passed with exit 0, zero errors, and zero warnings；client and server bundles were emitted.
- [x] Verification changed 0 files and performed no install, setting, credential, role, notification, Firestore, deployment, or Publish action.
- [!] First combined documentation update for these results failed atomically on stale candidate-README context；no partial edit occurred.
- [ ] Complete signed-in current-screen, Mobile portrait／landscape, Tablet portrait／landscape, title-editing, and Markdown-export Preview QA before publication.
- [x] Verified that application roles come from Firebase ID token Custom Claims；Google AI Studio account ownership is not an authorization source.
- [x] Current signed-in account resolves to normal `user`, consistent with the hidden Administration `ShieldCheck` control.
- [x] No admin／owner account is established by current evidence：owner allowlist／bootstrap variables remain unset and no bootstrap was run.
- [!] Packaging defect：`package.json` declares `role:bootstrap-owner` and `role:manage`, but `scripts/bootstrap-owner.ts`, `scripts/manage-role.ts`, and the entire `scripts/` directory are absent from both candidate and outputs.
- [x] Missing-path inspection errors were read-only；no role, claim, credential, environment, Firebase, source, deploy, or Publish mutation occurred.
- [!] First documentation patch for this audit was rejected before application because it contained an invalid placeholder；no partial edit occurred.
- [ ] Restore and independently security-review the missing role scripts before any owner bootstrap or admin-role E2E test；require separate explicit authorization for the actual privileged operation.
- [ ] Do not set role-related environment variables or claim admin readiness as a deadline workaround.


### 2026-09-05 — Direct Mobile portrait Preview observation

- Direct Chrome screenshot shows the signed-in Mobile portrait editor: Title is truncated within its reserved space and no longer visually overlaps Notifications or Safety; the Markdown export button is visible on the separate action row. No page-wide horizontal overflow is visually apparent; the composer mode strip has its own horizontal scrolling.
- This is a visual observation only. Title editing, export execution, other viewport modes, and admin/owner three-button layout remain untested. No journal input, data write, notification dispatch, role change, or Publish was performed.
- Opened the existing debug panel read-only. It contains Vite WebSocket connection failure and an unhandled rejection, plus four Firebase Auth App Check reCAPTCHA warnings. Their current reproducibility and impact remain undetermined; login and the journal UI are visibly available.
- Direct build log contradicts Gemini's reported zero warnings: it shows the >500 kB chunk advisory (JS 1,246.70 kB, gzip 343.12 kB), while build succeeded. Treat prior zero-warning statements as superseded by this direct evidence.
- Closed the debug panel without dismissing logs; preserved Mobile portrait state. Next: manually verify Title focus without changing text, then other responsive modes; investigate Preview warnings before declaring runtime QA complete.

- [x] User confirmed Mobile portrait Title receives focus normally without editing its value.
- [x] Mobile portrait Title／Notifications／Safety separation and Title focus pass.
- [!] First handoff-document patch failed atomically because Markdown list markers were parsed as patch operations；no partial edit occurred.
- [ ] Verify post-fix Markdown export clickability and Mobile landscape／Tablet portrait／Tablet landscape.
- [ ] Assess Preview WebSocket／App Check warnings and restore／review missing RBAC role scripts before privileged E2E claims.
- [x] Cancelled the special GPT-6 Astra low／GPT-5.6 medium switching preference；no model-routing requirement carries forward.

## 2026-09-05 — Responsive QA and Preview-warning triage

- Responsive overlap finding：closed for the tested normal-user path。Mobile portrait／landscape and Tablet portrait／landscape preserve separate hit targets for Title、journal actions、Notifications、and Safety。
- Export integrity：passed。The downloaded Markdown retained the expected reflection summary、all 4 bounded takeaways、and both conversation messages；no technical error text was present。
- Vite WebSocket error：not reproduced after explicit Preview reload。The earlier error and unhandled rejection are classified as transient Preview tooling failures based on current evidence。
- App Check warning：reproduced after reload。The transient AI Studio Preview `run.app` origin cannot satisfy the reCAPTCHA Enterprise key's published-domain restriction。This does not justify broadening the allowed domain or enabling enforcement；public-domain traffic remains the authoritative App Check evidence。
- Privileged RBAC verification remains blocked：no owner／admin identity is evidenced，and `scripts/bootstrap-owner.ts`／`scripts/manage-role.ts` are absent despite package-script references。
- No security control was weakened；no Secret、credential、role、notification、Firestore data、Rules deployment、cloud deployment、sharing、or publication state changed。

## 2026-09-05 — Missing RBAC CLI packaging finding closed locally

- Finding：`package.json` exposed `role:bootstrap-owner` and `role:manage` scripts while the referenced files were absent from the candidate。
- Remediation：restored the exact files from two byte-identical preserved sources after matching their imported security modules to the candidate。
- `bootstrap-owner.ts` requires target membership in `OWNER_UIDS`、the exact `BOOTSTRAP OWNER` phrase、a verified target email、a deterministic audit record、and a previously unused bootstrap audit ID。
- `manage-role.ts` accepts only `admin`／`user` transitions，uses the deterministic RBAC evaluation and confirmation phrase，prevents self-promotion and owner-role mutation，and creates an idempotent server-only audit record。
- Negative-path execution with all inputs absent：both commands rejected with exit `1` before Admin SDK initialization。No credential or data access occurred。
- TypeScript and production build passed。The Vite chunk-size advisory remains unrelated performance debt。
- Local packaging finding：closed。Privileged identity bootstrap and admin E2E：still pending；no role or access was granted during this remediation。

## 2026-09-05 — Canonical-candidate supply-chain and test gate

- [x] Created the D-drive GitHub candidate on branch `candidate/verified-2026-09-05` without copying `.git`、dependencies、build output、real `.env` files，logs，or Firebase CLI local state from the source workspace。
- [x] Restored the missing Firestore／security test harness only after matching every directly tested implementation dependency to the preserved source。
- [x] Replaced all pnpm lifecycle placeholders with reviewed decisions。Only `esbuild` may run；`@firebase/util`、`@google/genai`、`protobufjs`，and optional native `re2` are denied。
- [x] Frozen dependency install passed under pnpm `11.19.0`；only esbuild `0.25.12`／`0.28.2` postinstall executed。Lockfile SHA-256 remained `7E6A760F933968BAD42C037F63A09677B0A4B27B36BBD35E0CFC7014DC3FFF4B`。
- [x] Retained both inherited lockfiles with an explicit boundary：pnpm frozen install is the canonical verification path；`bun.lock` remains for the documented AI Studio／Bun path。Unrelated branches must not regenerate either lockfile。
- [x] Installed Microsoft OpenJDK `21.0.12.1 LTS` as a checksum-verified portable tool outside the repository。No Machine／User environment variable or global Java installation was created。
- [x] TypeScript validation passed。Production client／server build passed with the previously known non-blocking chunk-size advisory。
- [x] Location validation passed `5/5`。RBAC／notification／crisis-resource security tests passed `13/13`。
- [x] Firestore Rules emulator tests passed `30/30` with exit `0`。The logged `PERMISSION_DENIED` responses are required negative-test evidence，not suite failures。
- [x] Secret scan found no private key、GitHub token、OAuth secret，or bearer JWT。The one Google API-key match is the Firebase Web client configuration。Slack／Discord matches are confined to webhook-validation test fixtures。
- [x] Added `.firebase-config/` to `.gitignore` after discovering generated Firebase CLI state in the untracked file list。Verified `git check-ignore` resolves `.firebase-config/configstore/firebase-tools.json` to the new rule。
- [x] Recorded two non-security PowerShell input errors：the initial YAML here-string was cancelled／replaced without a partial write，and a concatenated status-output command caused a parser error after successful build completion。Neither weakened controls or changed cloud state。
- [x] Kept Git ownership protection intact after a Codex-sandbox read-only command received `dubious ownership` for the user-owned D-drive clone。Did not add a global `safe.directory` bypass；user-shell Git operations remained available。
- [x] Added `.gitattributes` with `* text=auto eol=lf` after the first staging pass exposed cross-environment LF-to-CRLF warnings。Renormalized the staged index and confirmed zero CRLF／mixed index entries。
- [x] Removed the exact whitespace defects reported by `git diff --cached --check` and the extra `index.html` EOF blank line。Final staged whitespace check exits `0`；post-cleanup TypeScript validation exits `0`。
- [x] Recorded two failed correction attempts：a pasted command concatenation prevented the first `.gitattributes` write，and .NET relative paths resolved under `C:\Windows\System32`。Both failed safely without modifying the intended targets；no ownership bypass or elevated write was used。
- [ ] Copy the refreshed handoff documents into the D-drive candidate，rerun the targeted commit-candidate scan，and inspect the complete staged diff before committing。
- [x] Copied the refreshed documents，repeated staged secret／environment／forbidden-path scans，and completed staged review：52 files，no forbidden paths，no unstaged changes，and expected fixture-only webhook detections。
- [x] Created local candidate commit `7133301` successfully；the immediate post-commit working tree was clean。
- [ ] Commit this documentation-only status refresh，then fetch and verify the remote before pushing the candidate branch。
- [ ] Do not merge／deploy／Publish or perform owner bootstrap／role mutation until the relevant final review gate is completed。
- [x] Created documentation-only commit `a438eac` and completed the read-only remote collision／ancestry gate。`origin/main` remained `ada36d3`，the remote candidate name was unused，and local divergence was `0 2`。
- [x] Pushed `candidate/verified-2026-09-05` successfully and configured upstream tracking。Remote and local commit hashes matched exactly at `a438eac580619469d9fbdfcd30c9fa76825b9e0f`；working tree clean。
- [ ] Commit／push this publication-status documentation update，then open a human-reviewed Pull Request into `main`。
- [ ] Keep merge、deployment、Publish、owner bootstrap，and role mutation behind their separate review gates。
- [x] Classified seven non-terminating `Split-Path` messages from the first documentation-only scan as a report-formatting defect：each zero-hit category supplied a null path to the display column，while all scan counts and the total remained `0`。
- [x] Reran the documentation scan with a zero-hit-safe per-match formatter。It completed without errors and returned `CORRECTED_DOCUMENT_SECRET_SCAN_HITS=0` across all seven secret patterns；no secret exposure or security regression was found。
- [x] Recorded a later read-only PowerShell parser error from piping a `foreach` statement directly。No file changed；the corrected variable-first verification confirmed all five documents had zero trailing whitespace and the expected scan-result marker。
- [!] GitHub secret-scanning alert `#1` detected the Firebase Web client key at `firebase-applet-config.json:4` in commit `7133301`。Triage used only masked value `AIza...2W0I` for Firebase project `jimmy-gemini-journal`。
- [x] Confirmed by static source review that this key is consumed as Firebase client configuration；Gemini and Google Maps server credentials remain separate environment variables。
- [ ] Verify the key's Application restrictions and API restrictions in Google Cloud Console。The key must be limited to required Firebase-related APIs and must not allow Generative Language API or unrelated billable APIs。
- [ ] Keep PR `#1` unmerged and leave the alert open until restriction review is complete。No rotation、restriction mutation、alert dismissal，merge，or deployment has occurred。
- [x] Console review confirmed key name `Browser key (auto created by Firebase)`，Application restrictions `None`，and an API allowlist with no Generative Language、Gemini、Maps、Places，or Geocoding APIs。
- [!] Least-privilege gap：the public client-key allowlist includes unused `Firebase AI Logic API` while App Check enforcement remains off，plus unused `Cloud SQL Admin API` and `Firebase SQL Connect API`。
- [ ] With explicit user approval，remove only those three APIs，save，wait for propagation，and perform production Auth／Firestore smoke tests before resolving GitHub alert `#1`。
- [x] Recorded two non-mutating read limitations：unauthenticated external access could not inspect private PR `#1`，and the first domain-search wrapper produced no usable output。Signed-in UI evidence and a corrected local search completed the review。
- [x] After explicit approval，removed `Firebase AI Logic API`、`Cloud SQL Admin API`，and `Firebase SQL Connect API` from `Browser key (auto created by Firebase)`。Save succeeded with no warning or error。
- [x] Confirmed Application restrictions remain `None` and the seven required Firebase Management、Cloud Logging、App Check、Identity Toolkit、Token Service、Cloud Datastore，and Cloud Firestore APIs remain selected。
- [x] Recorded two atomic documentation patch rejections：stale security-log context，then an invalid README context token。No partial edit occurred；independently anchored patches were used afterward。
- [ ] After propagation，perform the production read-only Auth／Firestore smoke。Keep alert `#1` open and PR `#1` unmerged until it passes。
- [x] Production DevTools Console／Network check found no targeted API-key restriction error or HTTP `403` after reload。
- [ ] Confirm landing render、authentication state、journal-list read，and one existing-journal read before resolving the alert。
- [x] Production functional smoke passed：landing、existing authentication、journal-list Firestore read，and existing-journal read were normal after the API allowlist update。
- [x] Combined smoke found no API-key restriction error、HTTP `403`，or functional regression；no data write or Gemini request occurred。
- [x] Classify the remaining detected value as intended public Firebase Web client configuration，not a server credential。Unused Firebase AI Logic／SQL APIs have been removed and the runtime gate passed。
- [ ] Sync this remediation evidence to PR `#1`，then dismiss GitHub alert `#1` as `Won't fix` with a precise audit comment。
- [x] Verified the alert detail displays `Validity: Unknown` and points to the `"apiKey"` property in `firebase-applet-config.json`。This confirms the expected Firebase Web client-config location；GitHub has no conclusive provider-validity result for the finding。
- [ ] Resolve alert `#1` as `Won't fix` with the audit comment，then verify the alert status reads resolved before considering the PR merge gate。
- [!] Residual risk accepted for the submission window：Application restrictions remain `None` and App Check remains unenforced，so an external actor may attempt allowed Firebase/Auth calls or consume quota。Firestore authorization continues to rely on the tested Security Rules；the key cannot call Gemini、Maps，or the removed unused APIs。
- [ ] After submission，test exact production／development HTTP referrer restrictions and App Check enforcement before enabling either control。Do not apply an untested deadline-day restriction that could block legitimate Firebase traffic。
- [!] User explicitly accepted deferral of both open controls for the submission window。Application restrictions remain `None` and App Check remains unenforced；reopen these items immediately after the submission is secured。
- [x] Recorded a non-mutating PowerShell parser error from the first read-only deferral-document check。The corrected variable-first command passed and found zero trailing-whitespace lines in all five documents。
- [x] Resolved GitHub secret-scanning alert `#1` as `Won't fix` with an audit comment identifying the value as intentional restricted Firebase Web client configuration。Alert status is `Dismissed`；`Validity: Unknown` and `Public leak` remain expected metadata。
- [ ] Sync and push this final alert-resolution evidence，then merge PR `#1` so the public default branch contains the reviewed security rules and documentation。
- [x] Synced and pushed final alert-resolution evidence in commit `df0c479`。Five hashes matched，documentation secret scan returned `0`，local／remote heads matched，and the working tree was clean。
- [x] Recorded a non-mutating GitHub cache miss from the assistant's external PR fetch。Authenticated owner UI must supply the final mergeability evidence。
- [ ] Merge PR `#1` after confirming head commit `df0c479` and no conflict or blocking check in the signed-in UI。
- [x] Merged PR `#1` into `main` as `20a8bc143ce342f443c89e8bea24ede97de329df`。The authenticated GitHub UI displayed purple `Merged` with no warning or error。
- [ ] Synchronize local `main` and verify public anonymous access to `README.md` and `firestore.rules` on the default branch。
- [x] Synchronized local `main` to `20a8bc143ce342f443c89e8bea24ede97de329df` and verified it equals remote `main` with candidate `df0c479` included。
- [x] Confirmed `README.md` and `firestore.rules` are tracked and anonymously accessible from public `main` with HTTP `200` responses。Repository submission security-content gate is complete。
- [x] Retained same-day Cloud Run evidence for exact challenge label and signed-out public access。A fresh assistant-side open was blocked locally by URL safety policy before receiving HTTP status；this is recorded as a tooling limitation rather than a service failure。
- [ ] Perform one final user-side public reload of the canonical Cloud Run URL before form submission。
- [x] Final user-side incognito reload passed：public landing access required no Cloud Console sign-in and produced no IAM／HTTP／TLS／render／redirect failure。Cloud Run public-access gate is complete。
- [x] Reviewed official Codelab and submission-form evidence。The form requires explicit Firebase Auth、Gemini、Firestore、Cloud Run／Secret handling disclosure plus public URLs；description limit is `1024` characters。
- [!] Claims must stay deployment-scoped：include deployed Google Maps、bilingual UI、deterministic safety，and backend authentication／rate limiting；do not present unverified privileged RBAC or external-notification delivery as live production behavior。
- [ ] Verify the Cloud Run revision still references the Gemini runtime value as a secret before selecting `Secure API key retrieval via Google Cloud Secret Manager`；if the UI only shows a plain environment value，leave that checkbox unchecked and correct the description。
- [!] Latest organizer notice confirms the hard deadline `2026-09-06 23:59 IST`／`2026-09-07 02:29 Asia/Taipei`，after which the dashboard locks permanently with no extension or exception。Do not delay submission for post-submission hardening、documentation cosmetics，or optional features。
- [x] Prepared a privacy-safe English demo storyboard。Recording must use synthetic data，hide email／avatar／UID，avoid DevTools and Cloud Console，show no secret or URL parameter，and omit undeployed privileged-feature claims。
- [x] Confirmed official public rules do not require a single-take／unedited recording。Use an edit between signed-out landing and authenticated dashboard to prevent Google account-chooser exposure；editing must not misrepresent deployed functionality。
- [!] Authenticated video frames expose the test account avatar and display name in the lower-left Sidebar。Collapse the Sidebar or cover the entire card with a persistent fully opaque `Demo Account` overlay；verify frame-by-frame that no identity text remains visible before upload。
- [!] Deadline moved to `2026-09-06 23:59 IST`／`2026-09-07 02:29 Asia/Taipei`。Before submission，verify public Cloud Run access、exact service label、public repository contents、hashtagged social post，and all mandatory form fields。
- [!] Pre-recording Gemini test is currently blocked by a `429`-class UI result：`Hourly chat limit reached or AI service is busy. Please try again later.` The same text covers local `RATE_LIMITED` and upstream `AI_RATE_LIMITED`，so do not claim the cause until the safe response body `code` and rate-limit response headers are inspected。Avoid repeated retries and never disclose the Firebase bearer token shown under Request Headers。
- [!] Production browser also reported `appCheck/recaptcha-error` and Firestore `Missing or insufficient permissions` during journal save。Do not treat the App Check warning as the proven Firestore cause until the Firebase Console shows the current Cloud Firestore enforcement state。Use ordinary Chrome with blockers disabled for the app origin，then run one-field-at-a-time write isolation before Gemini。Do not weaken Firestore owner／schema rules as a deadline workaround。
- [x] Verified Cloud Firestore App Check remains `Monitoring／Unenforced` and repeated the write path sequentially in ordinary Chrome。Blank create，title，mood，and two tag updates all synchronized；no Security Rules weakening was needed。The original Firestore denial remains a non-reproduced transient／ordering candidate，not a closed root cause。
- [!] The original `/api/chat` response details are unavailable because Network capture started afterward。Keep recording enabled and make only one controlled request after `2026-09-05 23:41 Asia/Taipei`，then inspect the response `code` without exposing Request Headers。
- [x] Classified the controlled `/api/chat` failure as upstream `AI_RATE_LIMITED`，HTTP `429`。Local rate-limit evidence was `19` remaining，reset at `2026-09-06 01:09:37 Asia/Taipei`，and no `Retry-After`；the app limiter was not exhausted。
- [!] Do not rotate，duplicate，or expose the Gemini key as a rate-limit workaround；official Gemini quotas apply per project。Inspect active RPM／TPM／RPD and tier for `jimmy-gemini-journal` before any paid-tier，quota，or model decision。
- [x] Inspected active Gemini limits：project is already `Tier 1`，and every relevant model is far below visible RPM／TPM／RPD caps。No quota or billing increase is justified from current evidence，and no financial setting was changed。
- [ ] Inspect Cloud Run `[Gemini Fallback]` logs for the controlled request and record only model names plus statuses。Do not expose environment values or Secret Manager contents。
- [x] Cloud Run log inspection confirmed all current fallback models returned `429`：3.6 Flash，3.1 Flash Lite，`gemini-flash-latest`，and 3.7 Flash。No Secret or payload was exposed。
- [ ] Implement and validate the minimal model-order hotfix with `gemini-2.5-flash` first and `gemini-2.5-flash-lite` second。Preserve authentication，rate limiting，deterministic crisis handling，payload bounds，and server-only credentials；do not weaken controls to restore availability。Validate supportive tone，action-item usefulness，summary fidelity，and `3`–`5` takeaway shape before publication。
- [x] Cancelled the unimplemented 2.5-primary proposal after confirming the landing page's explicit Gemini 3.6 Flash claim and the user's model requirement。
- [ ] Retain `gemini-3.6-flash` as primary and evaluate only bounded retry／backoff or clearly secondary fallbacks。Before public recording，verify the successful response's `modelUsed` is 3.6 if the narration or landing presentation attributes that response to 3.6。
- [x] Performed a read-only provider-status check on `2026-09-06`。No officially confirmed current global Google Cloud outage was found；the known `2026-09-01 us-central1-b` incident is recovered and regionally distinct。Recent independent Gemini probe failures plus this project's low usage／four-model `429` evidence support a possible Google-side serving incident，but this remains an inference rather than a confirmed global outage。
- [ ] Inspect Personalized Service Health for `jimmy-gemini-journal` and the authenticated Google AI Studio status page for project-specific notices before any deadline hotfix。Do not weaken authentication，rate limits，App Check，Firestore rules，or secret handling in response to transient upstream errors。
- [x] Recorded the non-mutating atomic rejection of the first five-file documentation patch caused by a stale `CONTEXT.md` anchor；the append-based retry completed without a partial intermediate state。
- [x] Reviewed project Personalized Service Health history。All supplied events are resolved；none directly matches the controlled Gemini Developer API 429。The resolved Vertex Gemini API event supports recent upstream instability，while the Cloud Run NodeJS build event does not explain runtime inference。No security control was weakened or changed。
- [x] Recorded the non-mutating direct-`foreach` pipeline parser error from the five-document verification；the variable-first retry passed。
- [x] CONVERSATION-HANDOFF-2026-09-06-GEMINI-429：preserved the context-limit handoff across all canonical documents。No credential，IAM，App Check，Firestore Rules，rate-limit，model，billing，or deployment setting changed。
- [ ] In the new conversation，recheck current Google AI Studio status and Personalized Service Health before retrying Gemini or implementing bounded exponential backoff。Keep the Firebase browser-key referrer restriction and App Check enforcement deferred until after submission as previously decided；do not weaken existing controls to work around upstream 429 responses。
- [x] Corrected the literal `$marker` handoff token produced by PowerShell escaping；no credential or security setting changed。
- [x] Rechecked current public provider status and current official Gemini billing guidance before modifying availability code。No broad severe incident was shown；project-specific authenticated billing evidence is controlling。
- [x] Verified exact project `jimmy-gemini-journal` shows `Tier 1 · Postpay`／`NT$0.00` and status `Prepay required`。
- [x] Verified linked `我的帳單帳戶` shows `Paid 1 · $250 Billing Account Tier Cap`，one linked project，and no configured prepayment method。Treat incomplete Prepay onboarding as the leading direct cause of the four-model `429` until disproven by post-activation testing。
- [x] Stopped retry／backoff implementation before changing `server.ts`。Do not amplify failed billing-gated requests or weaken authentication，rate limiting，App Check，Firestore Rules，or secret handling。
- [!] First Prepay setup load failed with a generic error and no charge；one retry reached the make-payment onboarding loader。The user took manual control before financial details or submission。No payment data was accessed or entered by the assistant。
- [ ] After user-operated Prepay completion，confirm a positive balance and cleared project status。Keep Auto-reload off unless separately reviewed and approved。
- [ ] Perform exactly one authenticated `/api/chat` regression after billing propagation。Record status and actual `modelUsed` without exposing Authorization headers or request content；only reconsider bounded retry if healthy billing still produces `429`。
- [x] Recorded the Git ownership clone failure and the non-mutating PowerShell parser error；both failed closed and did not alter canonical source or global security configuration。

## 2026-09-06 — Firestore empty-history rule evaluation remediation

- [x] Confirmed billing activation independently from the data-write issue：project status is `Tier 1 · Prepay` and the previous Prepay blocker is cleared。
- [!] Recorded an operator-account error：the first smoke used the wrong existing Chrome account。A synthetic request returned through `gemini-3.6-flash`，but Firestore denied both saves。No deletion or further mutation was attempted without authorization。
- [x] Reproduced the same write denial under the intended visible `Reflective Demo` account using an existing blank test entry，then stopped further Gemini requests。
- [x] Added a missing Rules regression for an authenticated owner updating an empty entry from `0` to `1` message through the frontend's full merge payload。
- [x] Reproduced the exact evaluation fault locally：Firestore Emulator returned `PERMISSION_DENIED` with `Index out of bound` for the empty-list slice。
- [x] Remediated only the invalid boundary evaluation。The new empty-history branch still requires the complete bounded message schema；owner isolation、immutable identity／creation fields、maximum `20` messages，and roll-forward protection remain intact。
- [x] Added an application-side fail-closed persistence gate：Gemini generation does not start when the user-message write fails；summary notification dispatch and success state require the summary write to succeed。
- [x] Passed Rules `31/31`、security `13/13`、location `5/5`、TypeScript，and production build。Expected `PERMISSION_DENIED` logs remain present only for negative security cases。
- [!] The fix exists locally only。Production remains vulnerable to message loss until the updated Rules and application are reviewed and deployed，then manually smoke-tested after propagation。
- [ ] With explicit deployment approval，publish the Rules and application。The user—not browser automation—then performs one synthetic blank-entry QA and confirms persistence after reload plus `modelUsed = gemini-3.6-flash`。
- [x] No credential、secret、IAM、quota、model order、rate limit，App Check enforcement，or browser-key restriction was weakened or changed。
- [x] Final `git diff --check` passed。Focused credential review found no new secret；the only webhook-shaped strings were pre-existing allowlist test fixtures，displayed because a PowerShell scan exclusion did not apply as intended。

## 2026-09-06 — Preview security gate after Rules release

- [x] Published the locally tested Firestore Rules to the exact named database without deploying unrelated Firebase or application resources。
- [x] Confirmed the production Maps browser key fails closed on the unauthorized transient Preview origin with `RefererNotAllowedMapError` while the authenticated `/api/maps-config` route remains healthy。
- [x] Used the dedicated origin-restricted Preview key for the controlled location lifecycle only；removed synthetic location data and restored the production key before any Republish action。
- [x] AI Studio typecheck／build and the intended-account first-message Preview regression passed。The user message persisted before Gemini generation，the response persisted after reload，no Firestore permission error occurred，and the actual model remained `gemini-3.6-flash`。
- [x] No API-key value、bearer token、payment information、full UID，or journal content was recorded。No App Check、IAM、quota、rate-limit、model-order，or API allowlist control changed。
- [!] Application source remains Preview-only until Republish。Production persistence remediation is Partial，not complete，until the published app passes the same controlled reload test。
