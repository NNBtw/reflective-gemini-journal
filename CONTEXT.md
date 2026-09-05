# Project Context & AI Collaboration Guidelines (CONTEXT.md)
> Last updated: 2026-09-04　Maintainer: Pin-Hao Huang
> Purpose: Let any fresh AI session (ChatGPT / Codex / Claude / Google AI Studio) get up to
> speed within minutes after reading this file plus the relevant code files — no need to
> re-explain background each time.

---

## 1. Project Overview
- **Core function**: Reflective is a security-first Gemini journal and AI companion where authenticated users can hold multi-turn reflective, brainstorming, and journaling conversations, with summaries stored in user-isolated Cloud Firestore paths. It supports emotional reflection and help-seeking, but does not provide diagnosis, treatment, or any guarantee of suicide prevention.
- **Current stage**: Live with follow-up product work and hardening in progress. Backend authentication, API abuse controls, hardened Firestore Rules, and the Firebase App Check client are deployed. App Check enforcement remains disabled while legitimate traffic is monitored. Three newer reflection-summary checkpoints exist only in AI Studio source and have not been published or exported locally. Normal signed-in summary generation, reload persistence, and Markdown export have passed in Preview; safety/error/isolation and post-publish cases remain pending.
- **Development platform**: Primarily built and iterated in Google AI Studio; backend deployed to Google Cloud Run

## 2. Tech Stack

### Frontend
- Framework & language: React 19, TypeScript, Vite
- UI & styling: Tailwind CSS v4 (`@tailwindcss/vite` plugin) + Motion (Framer Motion)
- Feature libraries: `lucide-react` (icons), `react-markdown` (rendering AI reply markdown)

### Backend
- Server framework: Node.js + Express, deployed on Google Cloud Run
- Runtime & bundling: Bun / tsx for development, esbuild for bundling
- Security: Backend manually verifies Firebase Bearer Tokens (RS256 signature), with rate-limiting to prevent API abuse

### BaaS & Database
- Firebase Authentication: Google one-click sign-in
- Cloud Firestore: primary database, path pattern `/users/{uid}/entries/{entryId}`, strictly scoped via `firestore.rules` (users can only access their own data)
- Firebase App Check (reCAPTCHA Enterprise) + Secret Manager (hides the Gemini API key)

### AI Integration
- SDK: `@google/genai` (official Google SDK)
- Model Fallback Ladder: defaults to `gemini-3.6-flash` → on retryable 429/5xx errors, falls back sequentially to `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`
- Deterministic Safety Response: backend uses regex to detect self-harm/suicide-related keywords; on match, it returns a fixed Taiwan crisis-resource response (e.g. the 1925 hotline) **without going through AI generation at all**

## 3. Environment Setup
```bash
# Frontend
bun install
bun run dev            # Vite dev server

# Backend
bun install
bun run dev             # tsx dev mode
bun run build            # esbuild bundling

# Deployment
gcloud run deploy ...    # fill in with actual deploy script
```

## 4. Directory Structure & Layering Rules
```
src/
├── components/     # React components, including JournalEditor.tsx
├── lib/            # Firebase client initialization
├── App.tsx         # Firestore subscription and owner-bound entry updates
└── types.ts        # Shared TypeScript data types
server.ts           # Express routes, auth, limits, safety interception, and Gemini calls
firestore.rules     # Owner-bound Firestore schema and access rules
firebase-applet-config.json
```
- **Layering rule**: The frontend must never call the Gemini API directly or hold the API key; all AI requests must go through the authenticated routes in `server.ts`.
- **Why**: The key lives in Secret Manager and requests must pass through safety interception and rate-limiting. Calling directly from the frontend would bypass those safeguards.

## 5. Code Style & Engineering Conventions
- **TypeScript**: Strict mode enabled. Avoid `any` in new code, validate external data at runtime, and prefer explicit interfaces or narrow unknown values.
- **React**: Functional components + Hooks only.
- **Express routes**: All routes requiring auth must go through the Bearer Token verification middleware — never skip it.
- **Firestore access**: All reads/writes must go through the `/users/{uid}/...` path; cross-user queries are forbidden.

## 6. 🚫 Safety-Critical Zone (Never modify during AI collaboration)
| Rule | Reason |
|---|---|
| ❌ Do not modify or remove the self-harm/suicide keyword regex interception logic | This is the last line of legal/safety compliance defense — any "optimization" could introduce false negatives |
| ❌ Do not route the post-match response through AI generation | Once a match is detected, the response must be fixed crisis-resource text, with no AI-generated uncertainty |
| ❌ Do not move Gemini API key logic to the frontend | The key must only ever live in Secret Manager, used via the backend |
| ❌ Do not relax Firestore rules to allow cross-user read/write | This violates the per-user data isolation design |
| ✅ When modifying the model fallback ladder, always keep at least one fallback tier | Prevents total feature failure during 429/5xx errors |

## 7. Known Limitations / Tech Debt
- The App Check-enabled frontend was successfully republished on 2026-09-03 and the public bundle was verified to load reCAPTCHA Enterprise. Enforcement remains disabled until legitimate App Check metrics and a rollback plan are reviewed.
- AI Studio Preview uses a transient `run.app` origin that is not included in the domain-restricted reCAPTCHA key, so its debug panel logs App Check token warnings. This is expected while enforcement is off and must not be confused with the separately verified public-domain activation.
- A user-reported authenticated public smoke test succeeded. AI Studio Preview tests also confirmed summary persistence across refresh, sign-out access boundaries, same-account restoration, and two-way journal isolation between two controlled accounts. Direct Firestore Rules allow/deny assertions still require emulator coverage. Never request passwords, OTPs, or Firebase tokens.
- The AI Studio backend summary checkpoint now requests structured JSON and validates bounded `summary` and `keyTakeaways`. It is not published and is present in the dated staging export `work/reflective-gemini-journal-export-2026-09-03/`; the prior local source remains preserved separately.
- The AI Studio frontend summary checkpoint adds the authenticated request, persistence, Insights UI, crisis banner, status states, and Markdown export. Initial review found a safety-relevant newest-message truncation defect and raw caught-error display.
- A focused remediation checkpoint now guarantees the newest user message within the 16,000-character transcript budget and restricts the UI to allowlisted error messages. Its diff passed code review; AI Studio reported zero TypeScript errors and a successful production build.
- Normal summary generation, persistence after reload, and Markdown export have passed in AI Studio Preview.
- The over-16,000-character newest-message crisis case, UI duplicate-request protection, offline summary allowlist, sign-out boundary, and two-account isolation passed in AI Studio Preview. Do not publish the reflection-summary checkpoints until the expired-session case and the remaining final verification steps are complete.
- The earlier hardened Firestore Rules revision is deployed. The newer transition-validation candidate passes 21 local Emulator tests covering owner access, cross-user denial, schemas, immutable fields, and the 20-message rolling boundary, but this newer revision is not deployed yet.
- Candidate-export review found weak nested Rules validation and raw/persisted general-chat errors. A subsequent unpublished two-file checkpoint remediated both at code-review level: Rules now perform bounded per-index validation, and chat errors use fixed transient alerts with static logging and no error-message persistence. User-reported offline/retry QA passed error redaction, reflection preservation, retry without duplication, and non-persistence after refresh. Exported source contains an icon-only `×` dismiss control that was not obvious during manual QA. Independent Rules syntax/emulator validation remains pending.
- The post-chat-remediation export passed TypeScript, frontend/server builds, dependency audit, and source secret scanning. Auth smoke testing found that unparseable JWT segments were sanitized but classified as `500 INTERNAL_ERROR`. A later unpublished single-file checkpoint converts decoder/parser and signature-verification failures to fixed `401 INVALID_TOKEN`; its post-auth export passed the local malformed-token regression matrix. A certificate-matched invalid-signature runtime case remains unexecuted because the local PowerShell TLS stack could not retrieve Google's public certificates.
- Rate limiting currently uses in-memory state within a single Cloud Run instance. A larger multi-instance production deployment should move this state to a shared store such as Memorystore and consider Cloud Armor.
- The crisis safeguard is keyword- and regex-based, so indirect language may be missed and false positives are possible. It is not a clinical risk assessment; a production mental-health product would still require clinical governance, privacy and retention policies, and incident-response ownership.
- The local export directory is not a Git repository, so no final commit hash is available. Public GitHub synchronization and a full history secret scan are still pending.
- A planned cost-gated milestone adds whole-UI language selection, multilingual voice input, and multilingual speech playback. The user requires total Google Cloud Platform/API spending to remain below the prepaid `NT$400`; no new paid translation or speech API is authorized. Prefer bundled locales and browser speech capabilities with BCP-47 tags and graceful text fallback. Browser speech coverage is user-agent/OS dependent and must not be described as universally guaranteed.
- The adopted first slice is UI-only localization for `zh-TW` and `en`: bundled dictionaries, browser-language detection, and a versioned `localStorage` preference. It must not add Firestore operations, backend calls, dependencies, or cloud configuration. Voice features and additional locales are deferred. User journal text, Gemini content, and backend crisis text remain untranslated content.
- The current named Firestore database is the owner-scoped journal store. Cost-safe language/voice V1 must not use it for locale, interim transcripts, or audio: use per-browser `localStorage` and ephemeral React state. Other devices receive the hosted feature without requiring the developer's computer, but locale preference does not automatically sync across devices.
- An unpublished AI Studio checkpoint now implements the `en`/`zh-TW` UI-only slice in nine `src/` files. Direct source review confirmed no locale or language instruction in `/api/chat` or `/api/summarize`; Gemini response language remains driven by user input.
- Signed-in Preview QA passed English-to-Traditional-Chinese switching, localized controls/dates/accessibility names, content non-translation, and persistence after reload with zero Gemini requests. The initial error badge was transient Preview App Check/Firestore/Vite connectivity and cleared on reload.
- A focused four-file checkpoint localized Markdown role/model/missing-value labels. Fresh exported-source review passed with locale-free Gemini payloads and unchanged backend/config/dependency manifest; the export's `bun.lock` was empty and local build re-verification remains pending due to a dependency-link filesystem restriction.
- Pending UI-localization work: signed-out selector, switch-back, browser/blocked-storage fallback, keyboard/responsive QA, two bounded cross-language Gemini tests, and inspection of localized English/Traditional-Chinese Markdown files.
- Signed-out selector QA passed both languages, localized landing states, reload persistence, keyboard selection, and no keyboard trap. A focused remediation then passed manual retest with visible focus indicators on both Landing and Sidebar plus working mouse/keyboard selection; verify the exact source diff in the next export.
- Responsive QA on 2026-09-04 passed desktop/English desktop and phone portrait, but failed Phone landscape and both Tablet orientations due to AI Lens versus entry-list/sidebar overlap. The fixed expanded composer also consumes excessive mobile height and needs an accessible localized collapse/expand control that preserves draft text.
- Follow-up Preview QA reports that the localized composer collapse/expand behavior works and the broad sidebar/editor collision is resolved. A minor visual overlap remains in Tablet portrait and Mobile landscape between the masked `/users/{uid}/entries` badge and the `Reflective` mood control; functionality is unaffected. Limit the next edit to `JournalEditor.tsx` responsive header layout and verify the five-file checkpoint from a fresh export.
- A second layout finding affects every tested viewport: AI Lens options overlap the composer collapse control. The combined one-file correction must keep that control outside a horizontally scrollable AI Lens region, expose a desktop scrollbar, and permit native touch swipe/pan anywhere in the option region on Mobile/Tablet.
- User subsequently confirmed both editor-header and AI Lens/collapse-control layout findings are resolved. Live inspection of Mobile landscape found a new Sidebar allocation defect: history scrolling works, but the list receives only a narrow visible strip because upper and lower fixed controls consume nearly all short-viewport height. Next edit should be isolated to `Sidebar.tsx` short-height landscape layout.
- The first `Sidebar.tsx` attempt failed live retest. Its AI Studio run was marked `Canceled`, and diff inspection showed invalid `landscape:max-h-[500px]:*` Tailwind candidates; `max-h-[500px]` is a sizing utility, not a media-query variant. Build success is insufficient evidence because invalid candidates may simply emit no CSS. Use a supported condition and recheck the actual Preview.
- Direct AI Studio Code remediation then replaced all 70 invalid prefixes in `Sidebar.tsx` with `landscape:max-lg:` without sending a Gemini prompt. After resolving a snapshot-save conflict in favor of the corrected source, the user manually confirmed in Mobile landscape Preview that the cramped conversation-history viewport is fixed. The 26-file history view was an initial-snapshot comparison artifact, not the actual edit scope. No publish/deploy occurred.
- Fresh responsive-remediation ZIP SHA-256 `F3552FBE2C2F2B6699CBC45D8C6B7A68D5B2F048DA61D52533EB40498F55E18E` passed independent source, compiled-CSS, TypeScript, production-build, dependency-audit, and secret checks. The exported Sidebar has 0 invalid and 70 supported prefixes. Backend, Rules, Firebase configuration, and package manifest are unchanged from the preceding checkpoint.

## 8. Changelog
| Date | Summary |
|---|---|
| 2026-09-04 | Synchronized the verified location feature into an unpublished AI Studio checkpoint: exact 12-file diff, clean typecheck/build, automatic signed-in Preview read observed, Maps runtime values not yet applied, and post-sync ZIP export still pending. |
| 2026-09-04 | Completed Firestore Emulator work: found the whole-array 1,000-expression defect, replaced it with transition validation, fixed the frontend 21-message edge, and passed 21/21 tests plus typecheck/build/audit/secret scan. |
| 2026-09-03 | Verified App Check client activation on the public deployment; enforcement remains off. |
| 2026-09-03 | Added an unpublished structured-output backend summary checkpoint in AI Studio. |
| 2026-09-03 | Reviewed the unpublished frontend summary checkpoint; blocked publication pending newest-message preservation and safe error-message mapping. |
| 2026-09-03 | Reviewed the focused frontend remediation checkpoint; both code blockers resolved, with manual tests and publication still pending. |
| 2026-09-03 | Passed the signed-in normal-summary Preview case with one persisted entry, a non-empty Insights summary, three takeaways, and no visible error. |
| 2026-09-03 | Passed Preview reload persistence and user-inspected Markdown export containing the summary and all three takeaways. |
| 2026-09-03 | Passed the synthetic over-16,000-character newest-message crisis test and confirmed the summary button was disabled during processing; no normal Insights card was generated. |
| 2026-09-03 | Passed the offline summary error test: fixed generic message only, no visible technical details, existing summary preserved, and recovery after reconnection. |
| 2026-09-03 | Passed the Preview sign-out access-boundary test and restored the saved journal and summary after same-account re-authentication. |
| 2026-09-03 | Passed two-way cross-account journal isolation in Preview using controlled Account A and Account B marker entries. |
| 2026-09-03 | Inspected the Preview debug panel: offline errors were expected Vite disconnects, summary logging was the static allowlisted event, and App Check warnings were attributable to the transient Preview origin. |
| 2026-09-03 | Downloaded and verified the latest AI Studio candidate; local typecheck/build/audit/secret scan and backend missing/malformed-token smoke tests passed, with two new review findings blocking publication. |
| 2026-09-03 | Reviewed the unpublished two-file remediation checkpoint; nested Rules and general-chat error findings are resolved at code-review level, pending negative-path and emulator validation. |
| 2026-09-03 | Passed the general-chat offline/retry Preview test: fixed error only, no technical leakage or error bubble, user content preserved, retry succeeded without duplication, and no operational error persisted; source has an icon-only dismiss control that was not obvious during QA. |
| 2026-09-03 | Verified the post-chat-remediation export and found one new blocker: unparseable JWT segments return sanitized `500 INTERNAL_ERROR` rather than `401 INVALID_TOKEN`; no authentication bypass or Gemini call occurred. |
| 2026-09-03 | Reviewed the unpublished `server.ts` malformed-JWT remediation checkpoint; fixed 401 classification is present and AI Studio reported a successful build, pending fresh-export local regression. |
| 2026-09-03 | Verified the post-auth export: expected source diff, TypeScript/build/audit/secret checks, and malformed-token regression passed; `abc.def.ghi` now returns `401 INVALID_TOKEN`. |
| 2026-09-03 | Recorded the requested cost-gated multilingual UI, voice-input, and voice-playback milestone; implementation has not started and no paid API was enabled. |
| 2026-09-03 | Reviewed the unpublished UI-localization checkpoint: locale-free Gemini payloads and signed-in `en` to `zh-TW` persistence passed; Preview connectivity errors cleared after reload, with export and remaining QA pending. |
| 2026-09-03 | Verified the focused export-label i18n source: four intended files changed, content stays verbatim, and Gemini payloads remain locale-free; Preview export QA and independent local rebuild remain pending. |
| 2026-09-03 | Signed-out locale QA passed language switching, persistence, and keyboard operation; logged a visible-focus defect on the transparent select for focused remediation. |
| 2026-09-03 | Focus-indicator remediation passed user-reported Landing and Sidebar keyboard/mouse regression testing without errors or keyboard trap; source-export review remains pending. |
| 2026-09-04 | Responsive QA passed desktop and phone portrait but found Phone-landscape/Tablet overlap plus an oversized non-collapsible composer; focused frontend remediation is required before cross-language API tests. |
| 2026-09-04 | Composer collapse passed follow-up Preview QA and the broad sidebar collision cleared; one cosmetic editor-header overlap remains for Tablet portrait and Mobile landscape. |
| 2026-09-04 | Added the all-viewport AI Lens/collapse-control overlap to the focused responsive-remediation scope, including desktop scrollbar and touch-swipe acceptance criteria. |
| 2026-09-04 | Confirmed the editor findings resolved, then directly reproduced a Mobile-landscape Sidebar history viewport that scrolls but is too short for useful browsing. |
| 2026-09-04 | Rejected the canceled Sidebar remediation after live failure and diff inspection exposed invalid height-variant class composition despite a successful build. |
| 2026-09-04 | Directly corrected the Sidebar responsive classes in AI Studio Code view; user-operated Mobile-landscape Preview passed, with fresh ZIP verification still pending. |
| 2026-09-04 | Verified the fresh responsive-remediation ZIP: intended CSS emitted, typecheck/build/audit/secret checks passed, and backend/security configuration remained unchanged. |
| 2026-09-03 | Adopted the first slice: complete `zh-TW`/`en` static UI localization with local-only preference storage and no new Firestore/API cost; voice features deferred. |
| 2026-09-03 | Clarified feature economics: browser-first language/voice adds zero direct Firestore operations or new paid speech/translation calls; named Firestore remains the existing journal store, and locale preference is per device. |

## 9. Status and Evidence Files

- `outputs/README.md`: project overview, current milestones, and public deployment status.
- `outputs/development-change-log.md`: chronological code, UI, AI Studio, checkpoint, and deployment history.
- `outputs/security-remediation-log.md`: security findings, controls, verification, and open remediation items.
- `PROJECT_STATE.md`: cross-session handoff snapshot.
- `work/reflective-gemini-journal/`: preserved pre-summary local export.
- `work/reflective-gemini-journal-export-2026-09-03/`: earlier downloaded candidate and its generated local verification artifacts; retained as a comparison baseline.
- `work/reflective-gemini-journal-post-chat-remediation-2026-09-03/`: post-chat-remediation candidate retained as the reproduction baseline for the now-fixed malformed-token classification defect.
- `work/reflective-gemini-journal-post-auth-remediation-2026-09-03/`: earlier security candidate and local verification artifacts; malformed-token finding closed, with Rules validation/deployment and final regression still pending.
- `work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/`: current verified local engineering baseline; Mobile-landscape Sidebar source, compiled CSS, typecheck, build, audit, and secret checks passed. Firestore Emulator work must use this directory without overwriting preserved snapshots.

### 2026-09-04 — Local Firestore Emulator architecture update

- Rules source under test: `work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/firestore.rules`.
- Planned local flow: Firebase CLI starts only the Firestore Emulator with a synthetic `demo-*` project ID; `@firebase/rules-unit-testing` supplies authenticated and unauthenticated client contexts; the test suite never connects to production Firestore.
- Required local prerequisites: Node.js, Firebase CLI, `@firebase/rules-unit-testing`, and Java. Node.js and `pnpm` are available; Firebase CLI, the Rules testing library, and Java were absent at the initial environment check.
- Planned repository additions are `firebase.json`, a Rules test file, package scripts, and development-only dependencies. Product API, UI, client Firebase configuration, and deployed cloud resources remain out of scope unless a reproducible test proves a Rules defect.
- Required matrix: owner CRUD; unauthenticated and cross-user denial; top-level and nested schema validation; immutable `id`, `userId`, and `createdAt`; boundary checks for titles, tags, messages, summaries, and 3–5 takeaways.
- Initial evidence status was setup inspection only; no Rules syntax or allow／deny result had passed at that point. Final evidence is recorded below.
- Local prerequisites are now staged: Firebase CLI `15.28.2`, `@firebase/rules-unit-testing` `5.0.2`, Microsoft OpenJDK `21.0.12.1` verified against the publisher SHA-256, and Firestore Emulator `v1.22.0`.
- First suite launch failed before Emulator startup because Firebase CLI attempted to access the sandbox-blocked user configstore. The retry redirects CLI configuration to an ignored project-local `.firebase-config/`; do not treat this setup error as Rules pass/fail evidence.
- The redirected run started Firestore Emulator successfully and confirmed demo-project isolation, but `tsx` failed before assertions with a sandbox-specific `uv_os_get_passwd ENOMEM`. Rules scripts now use Node 24's built-in TypeScript/test support.
- First actual Rules matrix result: 14/15 passed. A valid 20-message document was denied after hitting Firestore's 1,000-expression evaluation ceiling, so the current nested-validation revision is not deployment-ready despite enforcing the intended ownership/schema boundaries in the other cases.
- The remediation was scoped to reducing whole-array validation cost without weakening allowed keys, roles, modes, content bounds, timestamps, or owner isolation; the resulting transition-validation design is recorded below.
- Final architecture replaces whole-array revalidation with secure transitions: create 0–2 validated messages; update unchanged, append one validated message, or roll a full 20-message window by one. Existing history cannot be bulk-rewritten or shortened.
- `JournalEditor.tsx` now slices the final Gemini-appended list to `MAX_STORED_MESSAGES`, preventing a 21-message persistence attempt.
- Final evidence: 21/21 Emulator tests passed; TypeScript, frontend/server production builds, production audit, and source-only secret scan passed. The tested Rules/frontend changes remain local and undeployed.

---

## Companion: Opening Prompt for a New Session

```
You are now the collaborating engineer on this project.

[PROJECT CONTEXT]
Attach the complete contents of this `CONTEXT.md`, or provide this file directly as an attachment.

[TODAY'S TASK]
State the specific task, expected outcome, permitted modification scope, and any existing behavior that must remain unchanged.

Please confirm you understand the constraints above that are relevant to this task
(especially Section 6, the Safety-Critical Zone), before proposing or writing any code.
```

## Maintenance Principles
1. Update this file immediately whenever you introduce a new dependency, change the model fallback ladder, or modify any safety mechanism.
2. Keep this file under version control (git) so every AI tool (ChatGPT, Codex, Claude, etc.) shares the same baseline.
3. Section 6 ("Safety-Critical Zone") is the most important part of this document — it should never be trimmed for brevity.

### 2026-09-04 — Google Maps pinned-location architecture kickoff

- Current feature baseline remains `work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/`.
- Location flow is deterministic and consent-based: open picker, select coordinates, optionally label, then explicitly save or remove. Do not automatically request device geolocation in the first slice.
- Store only `{ latitude, longitude, label? }` under an optional journal-entry `location` field. Validate exact keys, numeric ranges, and label bounds in Firestore Rules while preserving `/users/{uid}/entries/{entryId}` owner isolation.
- Do not send saved location to Gemini, chat, summary, crisis classification, or logs. System instructions must state that the model cannot access Maps or API keys and must not infer or disclose exact coordinates.
- Lazy-load Maps JavaScript only while the picker is open. Server runtime reads `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID`; authenticated `/api/maps-config` returns the browser-required values with `no-store`. Missing configuration must fail closed without breaking core journaling.
- Production key requirements: separate Maps browser key, Websites application restriction for approved origins, Maps JavaScript API restriction, quota/usage monitoring, and no committed key value.
- Kickoff is documentation-only; tests, implementation, key provisioning, API enablement, deployment, and publication are not yet claimed.

### 2026-09-04 — Google Maps pinned-location architecture outcome

- Implemented files: `src/types.ts`, `src/lib/location.ts`, `src/lib/googleMaps.ts`, `src/components/LocationPicker.tsx`, `src/components/JournalEditor.tsx`, both locale dictionaries and typed dictionary, `server.ts`, `.env.example`, `firestore.rules`, `tests/location.test.ts`, `tests/firestore.rules.test.ts`, `package.json`, and source README.
- Data path: explicit picker → bounded `{ latitude, longitude, label? }` → existing `onUpdateEntry` → owner-isolated Firestore document. Removal persists `location: null`. Markdown export explicitly includes the saved coordinate and Google Maps link.
- Credential path: runtime Secret Manager／environment → authenticated `GET /api/maps-config` → lazy Maps JavaScript loader. The response is `no-store`; a separate 60/hour per-user limiter keeps it outside the Gemini quota.
- AI boundary: location never enters chat or summary payloads. Shared system text states the model cannot access Maps, API keys, browser location, or stored coordinates and must not infer or disclose exact location.
- Validation: client rejects blank/non-finite/out-of-range input and rounds to six decimals; Rules independently enforce exact keys, coordinate ranges, optional non-empty 120-character label, and owner isolation.
- Evidence: location tests 5/5; Emulator 24/24; TypeScript and production builds pass; audit has no known vulnerability; source scan has no new key. Unauthenticated config request returns `401 AUTH_REQUIRED` with no key/map ID.
- At the local implementation checkpoint, interactive signed-in Map QA and credential provisioning were pending. The later user-reported provisioning update is recorded below; no deployment or publication is claimed.

### 2026-09-04 — Google Maps external configuration checkpoint

- User-reported external state: production browser key `reflectai-journal-location-prod-web-key` and JavaScript vector Map ID `reflectai-journal-location-prod-js-vector` have been created in Google Cloud Console.
- Intended production boundary: Websites restriction allows only `https://reflective-journal-ai-companion.ai.studio/*`; API restriction allows only Maps JavaScript API. Use a separate dev key for `http://localhost:3000/*` and `http://127.0.0.1:3000/*` if local visual QA is needed.
- Configuration data flow is unchanged: runtime secret／environment → authenticated `GET /api/maps-config` with `no-store` → lazy client loader. Never place the real key in source, Firebase client config, logs, Gemini prompts, or this document.
- Verification boundary: Console restriction persistence has not been independently inspected. Runtime injection, deployment, signed-in picker QA, denied-origin QA, Maps usage review, and publication remain pending.

### 2026-09-04 — AI Studio Maps Secrets handoff update

- The user reports that Google AI Studio Secrets now contains the Maps runtime configuration. Expected names are `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID`; never request, expose, copy, or log their values.
- This supersedes the earlier current status that runtime injection had not been configured, but presence and injection remain user-reported until Preview runtime evidence is collected.
- Secrets alone do not activate the feature in the current AI Studio app: the local endpoint, picker, types, Rules, translations, and model instruction must first be synchronized to an AI Studio checkpoint.
- Next verification is signed-in and non-publishing: load picker, confirm approved-origin Maps loading, pin/save/reload/edit/remove, inspect Markdown export, confirm location remains absent from Gemini payloads, and review console/network failures.

### 2026-09-04 — AI Studio location synchronization outcome

- The verified local location implementation is now synchronized to an unpublished AI Studio checkpoint across exactly twelve mapped files. View Changes independently confirmed the exact scope and seventeen unchanged files.
- AI Studio typecheck and production build passed with zero errors. No dependency, lockfile, Sidebar, Firebase configuration, metadata, sharing, deployment, or publication change occurred.
- Build completion automatically opened the existing signed-in Preview and caused an owner-scoped Firestore list read. No write, delete, Gemini request, or Rules deployment occurred; do not rely on generated text claiming there was no live read.
- Preview exposed only the expected environment variable names and requested values, indicating that current Preview runtime injection is still unresolved. Never inspect or record the values; the user must apply the existing Secrets through the product UI if required.
- Automated post-sync ZIP export failed to produce a new file. A manual export named `reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04.zip` and independent hash/source comparison are still required.
- Release order remains: resolve runtime Secrets → obtain and compare post-sync export → explicitly approve and deploy tested Firestore Rules → run location E2E in Preview → publish only after a separate explicit approval.

### 2026-09-04 — AI Studio post-sync export verification architecture update

- Manual export completed and the downloaded archive was normalized to `reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04.zip` because the browser initially produced a duplicated `.zip.zip` suffix.
- Archive evidence: `298,783 bytes`; SHA-256 `1B4CB3DBB1E945FB8DD66D0484C3426393C1AAE5DFC3B6494BF32806EF002A78`. The preserved 29-file snapshot is `work/reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04/`.
- The snapshot contains all twelve intended location changes byte-for-byte. Of all common exported files, only `.gitignore` and `package.json` differ from the local engineering baseline, exclusively because the local baseline carries Emulator/location test scripts, dependencies, and ignored test state that were intentionally not synchronized to AI Studio.
- Independent current evidence is location utilities 5／5, Firestore Emulator 24／24, and successful frontend/server production builds. Expected deny-path `PERMISSION_DENIED` messages in the Rules suite are positive authorization evidence, not failures.
- Source scanning found no private key, Bearer token, Gemini secret, or Maps secret. `.env.example` contains `MY_*` placeholders; the existing Firebase Web client key remains the only `AIza...` value.
- Runtime truth is still separate from source truth: the archive proves the checkpoint contents, but not Preview secret delivery, Maps origin acceptance, Firestore Rules deployment, or production persistence. Those remain explicit QA/deployment gates.
- Updated release order: post-sync export comparison is complete; next verify runtime Secrets delivery without writing location data, then obtain explicit approval before deploying Rules, complete location E2E, and seek a separate approval before Publish.

### 2026-09-04 — Preview runtime Maps configuration evidence

- Signed-in Preview opened the location picker but failed closed before coordinate selection. The UI retained core journaling and kept `Save Location` disabled.
- Authoritative backend debug evidence was `injected env (0) from .env` followed by two fixed `MAPS_UNAVAILABLE: Maps are not configured.` errors. The current Preview process therefore has neither expected Maps runtime value, regardless of whether Secrets exist elsewhere in the AI Studio project UI.
- This is a runtime-injection blocker, not yet an origin-restriction or Maps JavaScript loader result. Apply the existing `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID` to the current Preview environment without exposing values, restart/reload the app, then retry picker loading before deploying Rules or testing persistence.
- No coordinate, Firestore write/delete, Gemini call, Rules deployment, publication, or secret inspection occurred during this gate.

### 2026-09-04 — Secrets name mapping and Preview-origin constraint

- AI Studio Secrets contained one Maps credential under the display name `reflectai-journal-location-prod-web-key`, not the required runtime name `GOOGLE_MAPS_API_KEY`; `GOOGLE_MAPS_MAP_ID` was absent. These UI rows must map exact environment names expected by `server.ts`.
- The Secrets UI's accessibility representation unexpectedly exposed the browser-key field value without an intentional visibility action. Do not reproduce or retain it. Rotate the key after mapping correction and reconfirm restrictions; this browser key remains client-visible by architecture and must never be reused as a server secret.
- The current Preview app runs at an ephemeral `https://ais-dev-...asia-northeast1.run.app/` origin. A production key restricted only to `https://reflective-journal-ai-companion.ai.studio/*` should not be widened casually. Prefer a separate, tightly restricted Preview/dev Maps JavaScript key for E2E, then retain the production-only key for publication.
- Value entry and `Apply` are human-controlled sensitive-data actions. Automation may verify names and later runtime behavior but must not type, copy, or submit the values.

### 2026-09-04 — Separated Maps browser-key origins

- User-reported Console configuration now has two Maps JavaScript browser keys: production allows only `https://reflective-journal-ai-companion.ai.studio/*`; Preview allows only the current `https://ais-dev-wwpeecywfneevyhaf6dcuq-656992758307.asia-northeast1.run.app/*` origin.
- Both keys are API-restricted to Maps JavaScript API only. The existing JavaScript Map ID is reusable; a second Preview Map ID is unnecessary.
- This reduces cross-environment credential scope but remains external-state evidence until Preview successfully loads Maps. Preview hostnames can change after rebuilds, so re-check the active origin before future QA rather than widening the production allowlist.

### 2026-09-04 — Preview Maps load-only runtime outcome

- After user-operated Secrets Apply and Preview reload, the authenticated picker rendered Google Maps successfully with Taiwan as the initial view.
- The earlier `MAPS_UNAVAILABLE` condition is resolved. No referrer, API restriction, Maps JavaScript loader, or Map ID error appeared; only the pre-existing AI Studio Preview App Check reCAPTCHA warning remained.
- Empty coordinates kept `Save Location` disabled. The picker was closed without selecting a point or transmitting precise location.
- This verifies runtime configuration delivery and the current Preview origin, but not Firestore persistence. Deploy and verify the tested Rules revision under explicit approval before pin/save/reload/remove E2E.

### 2026-09-04 — Named-database Firestore Rules deployment outcome

- Explicit approval was received, and the current location-aware Rules passed a fresh `24／24` Firestore Emulator run.
- Deployment routing is now explicit in `firebase.json`: project `jimmy-gemini-journal`, database `ai-studio-d82d6296-0049-4433-955f-91f203831d05`, rules source `firestore.rules`.
- Two pre-test tooling errors were environmental only: missing global `npm` and a bundled `pnpm` non-TTY purge guard. The project-local runner completed without dependency replacement. An initial unauthenticated deployment also failed before any release, then user-operated `firebase login --no-localhost` established the required account session.
- Firebase CLI subsequently compiled, uploaded, and released the Rules successfully. Source SHA-256 is `5BF26D72193716A62971ADB1AF7156F116E3C9368917D8A00484F37597715A94`.
- Deployment scope excluded Hosting, Functions, AI Studio Publish, and data writes. The next architectural gate is synthetic Preview persistence QA: pin, save, reload, remove, and inspect Markdown export after propagation.

### 2026-09-04 — Preview location persistence checkpoint

- User-operated Preview QA passed `pin → save → reload → remove` after the named-database Rules deployment.
- This provides UI-level evidence that the deployed schema accepts a valid location, the app reloads it from the owner-scoped entry, and removal persists. Live document contents were not independently inspected by the assistant in this turn.
- The test location is removed. Complete the export boundary next: no location data in a removed-state `.md`; exact synthetic label／coordinates／Google Maps link in a pinned-state `.md`; then remove the test point again.

### 2026-09-04 — Removed-state export boundary passed

- User downloaded and renamed the Markdown export after removing the test location.
- User-side searches returned zero matches for the location heading, previous label, and Google Maps query URL, confirming export omission in the removed state.
- The private Markdown content was not transferred to the assistant. Architecture verification still needs the positive pinned-state export and final cleanup.

### 2026-09-04 — Preview location E2E release gate complete

- User-operated positive export confirmed one correct location heading, one synthetic label, and one coordinate pair.
- The generated Google Maps URL opened the intended public landmark, and the file contained no credential.
- Final `Remove → Reload` succeeded, leaving no test location in the journal entry.
- Combined Preview evidence now covers runtime Maps loading, valid persistence, reload, removal, omitted-location export, included-location export, link behavior, credential absence, and cleanup.
- The checkpoint remains unpublished. Publication requires explicit approval and production-runtime credential verification／selection.

### 2026-09-04 — Production Maps credential selected for release

- User re-confirmed that the production browser key is restricted to the published AI Studio origin and Maps JavaScript API only.
- AI Studio runtime mapping `GOOGLE_MAPS_API_KEY` was changed from the Preview key to the production key; the existing JavaScript `GOOGLE_MAPS_MAP_ID` remains in place, and the user applied the change.
- Secret values remain outside chat, source, logs, and documentation. Evidence is user-confirmed UI state.
- Preview may no longer load Maps because its transient origin is intentionally not authorized by the production key. Do not weaken the production allowlist.
- Source, Rules, Preview E2E, export privacy, cleanup, and production credential gates are complete. Publication is the next separately authorized operation.

### 2026-09-04 — App Check release posture confirmed

- User verified that Cloud Firestore App Check is unenforced in Firebase Console.
- The release posture remains monitoring-only: the registered reCAPTCHA Enterprise client can emit tokens and metrics, while invalid／missing tokens are not yet blocked.
- No App Check setting changed. After publication, production smoke traffic and metrics review precede any separately approved enforcement change.

### 2026-09-04 — Published location release and post-publish snapshot

- The user explicitly authorized and manually completed AI Studio publication. The UI reported the app as published and `Ready` at `https://reflective-journal-ai-companion.ai.studio/`; the available action changed to `Republish`.
- The published description now accurately states the optional, explicitly confirmed pinned-location flow, Google Maps link, Markdown export, owner-isolated Firebase storage, exclusion of location from Gemini, and non-clinical／non-emergency scope.
- Automation did not republish, unpublish, or inspect Secrets. The first automated ZIP attempt timed out without creating a new file, so control was handed back to the user as requested.
- User-downloaded archive: `C:\Users\User\Downloads\reflective-gemini-journal-ai-studio-post-location-publish-2026-09-04.zip`; 298,783 bytes; SHA-256 `2153AD672833B9B8776AF723ABA9C7B747611A5CC6F22B92B23F2F02B9415798`; 37 entries／29 files／0 unsafe paths.
- Archive bytes differ from the pre-publish ZIP because of packaging metadata, but all 29 file-content hashes are identical. The published source therefore matches the already verified post-location sync checkpoint.
- Remaining architecture gate: production smoke testing and App Check metrics observation. Firestore App Check remains unenforced; enforcement requires a separate decision and approval.

### 2026-09-04 — Production load-only smoke gate passed

- User-operated production evidence: authentication succeeded, the owner-scoped journal list loaded, and the Google Map rendered normally at the published origin.
- Before any point was selected, `Save Location` remained disabled. No empty or implicit coordinate could be persisted.
- This verifies the production runtime mapping and the production-restricted browser key／Map ID path at load time. No coordinate selection, Firestore mutation, Gemini request, secret change, App Check enforcement change, or republish occurred.
- Remaining smoke sequence: use a non-sensitive public landmark, pin／save, reload and verify persistence, then remove／reload and verify final cleanup.

### 2026-09-04 — Production location write gate passed

- User selected a non-sensitive public-landmark test point. Marker and coordinates appeared correctly, and `Save Location` became enabled only after valid selection.
- Save succeeded; the journal rendered the expected label, coordinates, and Google Maps link without a reported permission, validation, or Maps error.
- This confirms the production location-write and display path under the deployed owner-scoped Rules. The synthetic location remains temporarily stored only for the next reload-persistence check.
- No Gemini request, secret／Rules／App Check change, deployment, or republish occurred. Reload verification and final remove／reload cleanup remain mandatory.

### 2026-09-04 — Production location persistence gate passed

- After a normal production reload, the same journal retained the synthetic location with an unchanged label and coordinates.
- Its Google Maps link continued to open the correct public landmark, and the user reported no authentication, Firestore-read, Maps, or rendering error.
- This verifies production persistence and read-back through the deployed Rules. The temporary point remains present only until the required remove／reload cleanup.
- No new write, Gemini call, secret／Rules／App Check change, deployment, or republish occurred during this read-back step.

### 2026-09-04 — Production location smoke architecture gate complete

- `Remove Location` succeeded and immediately removed the synthetic label, coordinates, location UI, and Google Maps link.
- A subsequent reload preserved the location-free state while the journal content remained normal; no authentication, Firestore, Maps, rendering, or validation error was reported.
- The complete user-operated production path now passes: authentication, owner-scoped list read, Maps load, safe disabled state, explicit public-landmark pin, save, render, reload persistence, Maps deep link, removal, and final cleanup reload.
- The assistant did not inspect private journal content or exact coordinates. No synthetic location remains, and no source, Gemini, secret, Rules, App Check, deployment, or republish change occurred.
- Runtime follow-up is now operational rather than a release blocker: observe App Check Verified／Unverified metrics while Firestore enforcement remains off pending a separate approved decision.

### 2026-09-04 — App Check metrics show mixed validity

- User-reported Cloud Firestore App Check metrics for the latest 24 hours: 81 total requests; Verified 50（62%）；Outdated client 0；Unknown origin 0；Invalid 31（38%）. Enforcement remains off.
- The invalid share blocks enforcement. Enabling it now risks rejecting traffic equivalent to those 31 invalid-token requests.
- This window mixes production and earlier AI Studio Preview activity, including the known Preview reCAPTCHA warning. Preview contamination is a plausible inference, not a confirmed cause; do not attribute all invalid traffic to either Preview or production without time／origin isolation.
- Keep monitoring-only. Generate a small production-only read sample with Preview／local clients closed, then inspect a shorter recent window after metrics propagation before considering any enforcement change.

### 2026-09-04 — Production-only App Check delta is not enforcement-safe

- After closing Preview／local clients and generating a small production read-only sample, 24-hour metrics changed from Total 81／Verified 50／Invalid 31 to Total 84／Verified 51／Invalid 33; Outdated and Unknown origin remained zero.
- The three-request increment is one Verified and two Invalid. Although too small for broad statistical claims and not immune to unrelated external traffic, it contradicts treating all invalid traffic as historical Preview contamination.
- Keep enforcement off. Pause traffic generation and inspect initialization ordering, Firebase web-app registration／reCAPTCHA Enterprise configuration, and the currently served production bundle before any remediation or new publish decision.

### 2026-09-04 — App Check integration inspection narrows configuration boundary

- Snapshot source initializes `ReCaptchaEnterpriseProvider` with auto-refresh before both Auth and the named Firestore instance. No obvious initialization-order bug was found.
- The production page currently loads `index-Bb7MtKAH.js`, `recaptcha/enterprise.js?render=explicit`, and the reCAPTCHA locale runtime. A background console read returned zero warnings／errors.
- A direct no-cache bundle download failed at the local TLS／authentication layer and produced no artifact; browser page-asset inventory supplied the verified script evidence instead.
- Client code presence is confirmed, but token validity is not. The next read-only boundary is the Firebase web-app registration and the Google Cloud reCAPTCHA Enterprise Web-key settings, especially exact key mapping, score-based integration, and a bare production hostname without scheme／path／port.

### 2026-09-04 — Firebase App Check registration identity confirmed

- Project settings contain exactly one Web app, whose Firebase App ID ends in `675f3232` and matches the published snapshot.
- App Check marks that app Registered with provider `reCAPTCHA Enterprise`.
- No registration or enforcement setting changed. Wrong-app selection and an unregistered provider are now excluded from the likely causes.
- Remaining configuration evidence is exact site-key mapping and the Google Cloud reCAPTCHA Enterprise Web-key integration／domain settings.

### 2026-09-04 — reCAPTCHA key mapping and domain gate passed

- The single Google Cloud key `reflective-journal-app-check` matches the published `recaptchaSiteKey` suffix without recording the full key.
- It is a Website／Score key, not Checkbox. Its only allowed domain is the bare production hostname `reflective-journal-ai-companion.ai.studio`.
- Domain verification is active because `Disable domain verification` is off; AMP use is also off. No setting changed.
- Source and external configuration now align. The next isolation variable is client environment: earlier traffic came from the Codex embedded browser, which may legitimately receive a low-risk assessment. Compare a small ordinary-Chrome read sample before proposing remediation.

### 2026-09-04 — Ordinary Chrome isolates App Check as healthy

- Before the ordinary-Chrome read sample, 24-hour Cloud Firestore metrics were Total 102、Verified 67、Invalid 35. Afterward they were Total 104、Verified 69、Invalid 35; Outdated and Unknown origin stayed zero.
- The two-request delta was 100% Verified with no Invalid increase. This verifies the normal Chrome production path and makes embedded／automated-browser risk classification the leading explanation for the earlier invalid increment.
- No source or configuration remediation is justified. Do not use Codex in-app-browser traffic as enforcement-readiness evidence. Keep enforcement off until historical invalid traffic ages out of the recent window and normal-browser metrics are reviewed under a separate approval boundary.

### 2026-09-04 — RBAC and notification architecture candidate

- New candidate root: `work/reflective-gemini-journal-rbac-notifications-2026-09-04/`. Published and historical snapshots remain unchanged.
- Authentication still enters through the existing Firebase ID Token verifier. Its trusted result now includes `uid`, normalized `role`, `auth_time`, verified email state, and email address. UI role checks are presentation only; backend middleware is authoritative.
- Role hierarchy is `user → admin → owner`. `admin` can read the non-sensitive administration overview. Only a signed `owner` whose UID also appears in `OWNER_UIDS` may review or apply `user ↔ admin` changes. Owner membership cannot be changed through the normal endpoint.
- Role mutation uses Firebase Admin SDK Custom Claims and a separate named-database `_adminAudit` collection. The client is denied all direct access. Changes require recent authentication, exact confirmation, reason, idempotency, non-self target, verified target email, and token refresh afterward.
- `ADMIN_ROLE_REVIEW_INSTRUCTION` defines AI as advisory-only. The model cannot approve or execute a change and receives no journal, credential, token, webhook, or recovery-code data. The current candidate returns the policy and deterministic findings; it does not spend a Gemini request on role authorization.
- Notification preferences live at `/users/{uid}/preferences/notifications` and contain booleans, bounded event names, consent version, and timestamp only. Credentials never enter the client document.
- Server-only `_notificationEvents` records hashed UID, event type, generic delivery status, and timestamps for idempotency／audit. They contain no journal text, summary, location, crisis wording, email address, token, key, or webhook.
- Gmail sends through OAuth 2.0 offline access and Gmail API `users.messages.send`. Slack and Discord use app-owned incoming webhooks in this V1 candidate. All secrets remain environment／Secret Manager values; redirects and non-approved webhook hosts are rejected.
- The opt-in／minimal-data decision is architectural: an external platform controls its own recipients, retention, forwarding, and access after delivery, so no external copy is created without explicit consent. Minimal generic events limit disclosure if a channel, account, or webhook is later compromised. Consent is revocable by disabling and saving the preference.
- Notification event allowlist is `summary_ready`, `weekly_reminder`, and `manual_test`. Crisis detection is intentionally absent: external delivery is not an emergency service and cannot replace the deterministic in-app crisis response.
- Safety region lives separately at `/users/{uid}/preferences/safety`. It stores only `IN`, `TW`, `EU`, or `GLOBAL` plus timestamp. The value is explicitly selected; GPS, IP inference, pinned journal location, and Gemini inference are excluded.
- Crisis wording is built in `server/crisisResources.ts` before any model call. India uses Government of India `112` and Tele-MANAS `14416／1800-89-14416`; Taiwan preserves existing resources; EU uses `112`; global／unknown uses Find A Helpline. The selected region is never added to Gemini instructions.
- Automatic dialing and background trusted-contact notification are excluded. A future contact action may only open a user-initiated device dialer after separate consent／design review.
- New backend modules: `server/firebaseAdmin.ts`, `server/rbac.ts`, `server/notifications.ts`, `server/crisisResources.ts`. New UI: `AdminDashboard`, `NotificationSettings`, and `SafetySettings`. New pure tests cover RBAC, notification payloads／webhooks／Gmail MIME, and regional crisis resources.
- Verification is local only: TypeScript pass; security tests `13／13`; location tests `5／5`; Firestore Emulator `30／30`; production build pass; audit no known vulnerabilities. No live credential, role, delivery, deploy, sync, or publish operation occurred.
- Pending infrastructure gates: least-privilege Admin SDK IAM, explicit owner bootstrap, Gmail OAuth consent plus Secret Manager values, Slack／Discord channel model decision, signed-in UI／API E2E, revised Rules deployment, AI Studio synchronization, publication, and separate App Check enforcement review.

### 2026-09-04 — Google AI Studio／local merge baseline

- The project uses a hybrid workflow: Google AI Studio is the primary Build app and publication surface, while later reviewed security and feature work also exists locally.
- Current AI Studio app ID is `d82d6296-0049-4433-955f-91f203831d05`; Firebase project is `jimmy-gemini-journal` and the named Firestore database uses the same UUID identifier.
- A fresh AI Studio ZIP was downloaded read-only. Source-only SHA-256 comparison proves the current AI Studio `src/components/Sidebar.tsx` and local candidate copy are identical, so the later Mobile-landscape remediation is preserved.
- Local-only implementation scope is the RBAC, external-notification, and deterministic regional-safety delta plus supporting dependency metadata, tests, scripts, and documentation.
- The first whole-tree diff failed on an unreadable `node_modules` dependency path. The fallback comparison deliberately excluded dependencies, build output, Firebase CLI state, and emulator artifacts and completed successfully.
- Treat AI Studio current as the runtime baseline and the local candidate as a reviewed delta. Never replace the AI Studio project from an older snapshot or deploy directly from the local folder without first synchronizing and building inside AI Studio.
- No live role, credential, Secret, Rule, sharing, deployment, or publication change occurred during this baseline check.
- Prepared local sync payload: 17 target attachments plus one strict AI Studio instruction document. It excludes `Sidebar.tsx`, dependencies, builds, CLI／emulator artifacts, tests, pnpm lockfiles, and all credentials. Corrected secret-pattern scan passed; upload and AI Studio submission are still pending explicit action-time confirmation.

### 2026-09-05 — AI Studio access blocker

- User authorized the exact upload and unpublished code-edit action. Browser automation nevertheless rejected multi-file and single-file chooser uploads with `Not allowed`; no attachment reached AI Studio.
- The payload was copied byte-for-byte to `outputs/ai-studio-sync-payload-2026-09-04/`; all 18 file hashes match the scanned work copy.
- Direct full and reduced safety-only prompts failed before edits in old and clean chats. Gemini 3.8 Flash and Gemini 3.6 Flash both produced `RpcError: The caller does not have permission` in console evidence.
- Settings reports free requests. `Select an API key` leads to an upgrade dialog with paid options; none was selected.
- Current state remains local-candidate complete, AI Studio unchanged, and production unchanged. Resume through user-operated payload upload or a separately approved paid-access decision.
- 2026-09-05：The temporary AI Studio editing-chat override was restored and visually verified as `Default (Gemini 3.8 Flash)`. This changes only the Build assistant chat preference; the application runtime fallback ladder and all source／cloud state remain unchanged.
- 2026-09-05：AI Studio requested all `.env.example` placeholders during attachment application. `BOOTSTRAP_*`／`ROLE_*` are command-only inputs and must not persist; `FIRESTORE_DATABASE_ID` is non-secret with a correct code default; `OWNER_UIDS` and notification credentials remain intentionally unset until separately approved provisioning. Build must proceed without fabricated values.

### 2026-09-05 — Manual AI Studio synchronization verified

- User manually uploaded and submitted the 17-file payload. AI Studio reported clean TypeScript and production builds under Default Gemini 3.8 Flash with optional configuration unset; no live role, notification, Firestore, Rules, deployment, sharing, or publication action occurred.
- Downloaded post-sync ZIP: `reflective-gemini-journal-ai-studio-rbac-notifications-safety-build-verified-2026-09-05.zip`; 349,873 bytes; 46 entries; zero unsafe paths; SHA-256 `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`.
- Exact comparison: all 17 target files match the upload payload, zero non-target baseline files changed, and `bun.lock` is unchanged. This closes the AI Studio source-synchronization integrity gate.
- Independent local evidence: 37-file secret scan found only the expected public Firebase Web API key; TypeScript passed; production frontend/server build passed outside the sandbox. A first install was interrupted by antivirus quarantine, one pnpm install hit build-script policy, and the first build hit sandbox directory access; each is recorded as an environment event.
- Dependency audit remains open because the archive uses Bun while the local verifier only had pnpm. A temporary pnpm resolution reported a moderate `uuid 9.0.1` advisory and must not be represented as a Bun audit result. Any retry is manual/user-led per the user's instruction.
- Current release state: source synchronized and build-verified, but still unconfigured and unpublished. Owner bootstrap, role mutation, Gmail／Slack／Discord delivery, live API negative-path QA, revised Rules deployment, and publication remain separate explicitly approved gates.

- 2026-09-05 manual audit prerequisite：The user ran `bun --version`; PowerShell reported that Bun was not recognized. No project or cloud action occurred. Dependency audit remains paused until the user installs Bun from the official Windows source and confirms its version in a new terminal.

### 2026-09-05 — Free Trial billing preparation

- Target Free Trial credit is TWD 9,564 equivalent to USD 300, 100% available, expiring 2026-10-14. Official program limits mean it cannot pay Gemini API in AI Studio costs, although eligible Google Cloud／Maps costs can consume it.
- User created `jimmy-gemini-journal-free-trial-monitor-2026` as an alerts-only budget：custom 2026-09-05–2026-10-14 period, TWD 3,000 target, actual thresholds TWD 300／1,000／3,000（10%／33%／100%）.
- Promotional credits are excluded from budget math only; this keeps pre-credit spend visible and does not deactivate the USD 300 credit. Seven other savings categories remain included.
- No spend cap or automation exists. Initial spend is TWD 0. Project billing link is unchanged; next gate is a direct `Change billing` operation without first disabling billing.

- 2026-09-05 billing association：The user used direct `Change billing` to move exact Project ID `jimmy-gemini-journal` from `Jimmy` to target `My Billing Account`. Google Cloud Console reported the project was moved successfully. Billing was never disabled; no source／Secret／Rule／deploy／publish state changed. Treat this as user-operated success pending project-row read-back and Firebase Blaze verification.

- Billing read-back passed：Cloud Billing `My projects` now lists `jimmy-gemini-journal` under `My Billing Account`／`我的帳單帳戶`, with no disabled, pending, error, lock, or warning state. Billing reassociation is complete; Firebase Blaze status is the next read-only verification gate.

- Firebase continuity passed：`jimmy-gemini-journal` still reports `Blaze／Pay as you go`, with no billing error, relink request, or service restriction. Next perform post-billing-change runtime smoke tests only in ordinary Chrome; do not use the Codex embedded browser as App Check evidence.

- Post-billing production smoke Step 1 passed in ordinary Chrome：published app load, authentication, journal-list Firestore read, and existing-journal open all worked with no relevant error. No data mutation or Gemini request occurred. Next test Cloud Run Maps-config delivery and Google Maps rendering read-only.

- Post-billing production smoke Step 2 passed：Cloud Run delivered authenticated Maps configuration, Google Maps rendered, empty selection kept save disabled, and closing／reopening left the journal location-free. The full post-change runtime gate is complete with no data mutation or Gemini request. Wait for Billing Reports latency before checking Free Trial credit attribution.

- Reminder automation blocker：two one-time Codex reminders were rejected due to timezone-anchored scheduling semantics; zero automation was created. Per user preference, no automatic retry occurred. Create equivalent Asia／Taipei reminders manually in Google Calendar.

### 2026-09-05 — Cloud Run submission identity read-back

- Project `jimmy-gemini-journal` 的 healthy service 為 `reflective-gemini-journal-companion`，region `us-west1`。
- Required challenge metadata 已存在：`dev-tutorial=cloud-run-ai-challenge`；不需產生新的 revision。
- Cloud Run endpoint panel 明列 custom domain `reflective-journal-ai-companion.ai.studio`，確認 published AI Studio hostname 對應此 service。
- 兩個 default HTTPS endpoints 均 enabled，但目前證據中的 Console URLs 被省略號截短；完整 `run.app` hostnames 待使用者以 Copy link 唯讀取得。
- 本次沒有 code、Secret、role、Rules、data、billing、traffic、deploy 或 publish change。前兩次 multi-file patch 因 context mismatch 安全地整批取消，per-file retry 才寫入紀錄。

### 2026-09-05 — Complete Cloud Run endpoint identity

- Default endpoint 1：`reflective-gemini-journal-companion-516107960247.us-west1.run.app`。
- Default endpoint 2：`reflective-gemini-journal-companion-ktotj325za-uw.a.run.app`。
- 兩者與 custom domain `reflective-journal-ai-companion.ai.studio` 都對應同一個 `reflective-gemini-journal-companion` service。
- Endpoint 1 暫定作為 challenge form canonical Cloud Run URL；下一 gate 是 signed-out／incognito public-access smoke。
- 本次只讀取既有 endpoints；沒有 query parameter、login data 或 cloud mutation。首次 combined documentation patch 因 CONTEXT mismatch 原子失敗，沒有 partial edit。

### 2026-09-05 — Canonical Cloud Run public-access gate

- Fresh signed-out／incognito test passed for `reflective-gemini-journal-companion-516107960247.us-west1.run.app`。
- Landing page rendered normally；final hostname remained the same。
- No Cloud Run IAM `403`, `404`, `5xx`, certificate warning, blank page or redirect loop appeared。
- Endpoint 1 is now the canonical challenge-form Cloud Run URL candidate；custom-domain public access remains the next check。
- No authentication, data mutation, Gemini request, deployment, traffic, or publication action occurred。

### 2026-09-05 — Human-facing custom-domain public gate

- Signed-out／incognito test passed for `reflective-journal-ai-companion.ai.studio`。
- Landing page rendered normally；final hostname remained the custom domain。
- No `403`, `404`, `5xx`, certificate warning, blank page or redirect loop appeared。
- Both submission-facing URLs now have public-access evidence；next perform signed-in Preview QA before candidate Publish。
- No authentication, data mutation, Gemini request, deployment, traffic, or publication action occurred。

### 2026-09-05 — Candidate Preview responsive blocker

- Signed-in normal-user Preview passed RBAC visibility：notification／safety buttons present，administration button absent。
- Tablet portrait／landscape 與 Mobile landscape passed by user report。
- Current screen size overlaps Markdown export；Mobile portrait overlaps title editing。
- Direct computer-use observation confirmed about 41 px Notification／Export collision；`src/App.tsx:243` uses an independent `fixed right-4 top-4 z-40` group outside the `JournalEditor` header flow。
- Block Publish until responsive placement is fixed and affected viewports are retested。Observation was read-only；no setting, delivery, source, deploy, or publish mutation occurred。

### 2026-09-05 — Mobile portrait overlap measured

- Direct read-only observation at `375 × 667` confirmed both fixed global controls overlap the title input。
- Title：`x 60.0–359.4`；Notification：`x 269.1–310.3`；Safety：`x 318.3–359.4`。Each button intersects about 41 px and together consume roughly the last 90 px。
- Publication remains blocked pending responsive spacing remediation and viewport regression testing。
- No UI input, device switch, preference write, notification, source, deployment, or publication mutation occurred during observation。

### 2026-09-05 — RBAC icon identity

- Sidebar `隔離路徑運作中` uses a small `Shield` status icon；it is not the Administration action。
- Administration uses a separate top-right `ShieldCheck` button and renders only for `admin／owner`。
- Its absence for the current normal user is expected RBAC behavior。Read-only source inspection only；no role, token, UI, or source mutation。

### 2026-09-05 — Downloads archive inventory

- Top-level read-only inventory found 9 Reflective／Gemini Journal ZIPs in Downloads and no matching extracted folder。
- Latest ZIP is byte-identical to the existing `outputs` copy，SHA-256 `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`。
- No move, overwrite, deletion, extraction, or rename has occurred；destination remains pending confirmation。
- Current extracted build workspace remains under `work\ai-studio-rbac-notifications-safety-build-verified-2026-09-05` and is unaffected by moving archives。

### 2026-09-05 — Proposed manual D-drive archive destination

- Base `D:\Lessons\Computing\_Lessons\Google\Hack2skill (H2S)\Gen AI Academy APAC\Ideathon Challenge` is suitable for archive use，with ample D-drive space。
- Only `D:\Lessons` currently exists；remaining folders require manual creation。
- Prefer `archives\ai-studio-exports\2026-09-05` below that base to separate downloaded history from active source。
- Moving the 9 Downloads ZIPs only will not alter the current C-drive build workspace。No folder or file mutation performed by Codex。

### 2026-09-05 — Downloads archive move verified

- Actual destination uses single folder `Computing_Lessons`，not the previously interpreted `Computing\_Lessons` segments。
- Dated archive leaf contains exactly 9 matching ZIPs；Downloads contains 0。
- Latest ZIP hash remains `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`。
- Two pre-existing ZIPs in `myproject zip files` were not part of the move and remain untouched。
- Codex verification was read-only；active C-drive build workspace is unchanged。

### 2026-09-05 — User-shell build prerequisite blocker

- `pnpm run build` was invoked from the correct project directory，but PowerShell could not resolve `pnpm`。
- The build script never started；no package, lockfile, source, build artifact, deploy, or publish mutation occurred。
- This is a user-shell PATH／tool availability issue，not a source compilation result。
- Manual fallback active：do not install pnpm automatically。Check only existing `node --version` and `npm --version` next。

### 2026-09-05 — Bundled Node／pnpm manual fallback

- User-shell `node --version` failed；Node is absent from PATH and npm was not tested。
- Existing Codex runtime contains Node 24.19.0 and a self-contained `pnpm.cmd` wrapper。
- Wrapper uses its adjacent bundled Node／pnpm module，so no install or PATH mutation is required。
- Next manual step is absolute-path `pnpm.cmd --version` only；build remains paused。

### 2026-09-05 — Bundled pnpm prerequisite passed

- Absolute Codex runtime wrapper returned `pnpm 11.19.0` in the user PowerShell。
- No install, PATH, dependency, lockfile, source, artifact, deploy, or publish mutation occurred。
- First documentation wrapper parse failed before patch execution；no partial edit。
- Next manual gate is production build from the exact candidate directory using the same wrapper。

### 2026-09-05 — Bundled wrapper child-process PATH blocker

- Absolute pnpm wrapper started the expected script，but the Vite `.cmd` child could not resolve `node.exe` from current PowerShell PATH。
- Build stopped before Vite compilation with `ELIFECYCLE` exit 1；no dependency, lockfile, source, artifact, deploy, or publish mutation。
- Next manual gate：prepend bundled Node `bin` to the current process PATH only，verify Node 24.19.0，then retry manually。
- Never persist this as a User／Machine PATH change。

### 2026-09-05 — Process-local Node prerequisite passed

- Temporary current-shell PATH prepend succeeded；`node --version` returned `v24.19.0`。
- Vite／esbuild child shims can now resolve bundled Node in this PowerShell process。
- No persistent User／Machine PATH, install, dependency, lockfile, source, deploy, or publish mutation。
- Production build is ready for manual retry with the absolute pnpm wrapper。

### 2026-09-05 — Challenge submission priority

- Official portal deadline from user evidence：2026-09-07 02:29 IST＝2026-09-07 04:59 Asia／Taipei. Internal working deadline：2026-09-06 18:00 Asia／Taipei.
- Submission requires a public prototype／walkthrough, public social demo post with `#AccelerateAIwithCloudRun`, public source repository, brief Firebase／Firestore／Cloud Run／Gemini description, service confirmations, and Cloud Run label `dev-tutorial=cloud-run-ai-challenge`.
- The screenshots and Codelab URL are requirement evidence, not submission replacements. Prototype／video／description／repo packaging remain unfinished. Prioritize submission completion over Billing Reports latency review.

- User created the four manual submission Calendar milestones. They want the RBAC／external-notification／regional-safety candidate included before submission for stronger originality／security evidence. Candidate publication is conditional on Preview and production gates; the verified location-enabled production release is the deadline fallback. First inspect the required Cloud Run label read-only.

### 2026-09-05 — Responsive candidate build gate passed

- User-operated production build passed with bundled Node `v24.19.0`, pnpm `11.19.0`, Vite `6.4.3`, and esbuild。
- Vite transformed `2271` modules in `4.28s`；client assets and `dist/server.cjs`／source map were emitted successfully。
- Generated CSS contains the required `pr-24`, `xl:pr-0`, and `xl:pr-24` utilities。An earlier false-negative probe was caused by selector-escaping mismatch，not missing Tailwind output。
- The `1,246.10 kB` minified JS chunk warning is non-blocking performance debt，not a build failure。
- Current release state：local source＋typecheck＋production build pass；AI Studio sync，responsive Preview regression，and Publish remain pending。

### 2026-09-05 — AI Studio attachment blocker

- First responsive synchronization prompt arrived without the referenced attachment／source text。
- Gemini 3.8 Flash stopped safely，changed 0 files，and did not deploy or Publish。
- Its typecheck／build pass applies only to the unchanged AI Studio baseline，not the local responsive revision。
- Manual next step：attach the local `JournalEditor.tsx` and confirm the filename is visibly present before resubmitting the single-file replacement instruction。

### 2026-09-05 — AI Studio line 489 mismatch

- Second attempt changed exactly `src/components/JournalEditor.tsx` and retained both responsive class additions。
- AI Studio's copy contains undefined `errorDataCode(errData)` at line 489，causing `TS2304`／typecheck exit 2；Gemini stopped safely。
- The local attachment instead contains valid `errData.code`，and a fresh local `tsc --noEmit` passes。
- AI Studio production bundle success is insufficient because Vite／esbuild did not catch this semantic type error。
- Publish remains blocked。Next manual action is an exact one-line restoration followed by typecheck and build。
- A separate incorrect Bun executable-path probe failed read-only and caused no mutation。

### 2026-09-05 — Manual line repair awaiting verification

- User reports manually restoring AI Studio line 489 to `errData.code` and saving。
- Editor search was unavailable，so `errorDataCode = 0` and preservation of `pr-24 xl:pr-0`／`xl:pr-24` are not yet confirmed。
- Next gate is a no-edit Gemini inspection plus typecheck and build。Publish remains blocked。

### 2026-09-05 — AI Studio static verification passed

- Read-only verification changed 0 files。
- `errorDataCode` count＝0；correct `errData.code` line is present。
- `pr-24 xl:pr-0` and `xl:pr-24` are present at lines 606／638。
- Typecheck and production build both exited 0 with no errors or warnings；client and server bundles completed。
- No install，settings，credentials，roles，notifications，Firestore，deploy，or Publish action occurred。
- First combined documentation patch failed atomically on stale candidate-README context；no partial edit occurred。
- Next gate：signed-in responsive／interaction Preview regression；Publish remains blocked。

### 2026-09-05 — RBAC identity／packaging audit

- AI Studio Google-account identity does not grant app admin。Only Firebase ID token Custom Claim `role=admin|owner` does；missing／other claims normalize to `user`。
- Current account has no recognized privileged claim，so hidden Administration control is expected。
- No owner／admin is established by available evidence；owner bootstrap／allowlist variables remain unset and bootstrap was never run。
- `package.json` declares owner-bootstrap／role-manage commands，but the candidate and outputs lack both referenced files and the entire `scripts/` directory。Read-only access produced path-not-found errors。
- First documentation patch for this audit was rejected atomically due to an invalid placeholder；no partial edit。
- Normal-user responsive QA may continue；owner bootstrap and truthful admin-role E2E are blocked pending script restoration，review，tests，and separate authorization。


### 2026-09-05 — Direct Mobile portrait Preview observation

- Direct Chrome screenshot shows the signed-in Mobile portrait editor: Title is truncated within its reserved space and no longer visually overlaps Notifications or Safety; the Markdown export button is visible on the separate action row. No page-wide horizontal overflow is visually apparent; the composer mode strip has its own horizontal scrolling.
- This is a visual observation only. Title editing, export execution, other viewport modes, and admin/owner three-button layout remain untested. No journal input, data write, notification dispatch, role change, or Publish was performed.
- Opened the existing debug panel read-only. It contains Vite WebSocket connection failure and an unhandled rejection, plus four Firebase Auth App Check reCAPTCHA warnings. Their current reproducibility and impact remain undetermined; login and the journal UI are visibly available.
- Direct build log contradicts Gemini's reported zero warnings: it shows the >500 kB chunk advisory (JS 1,246.70 kB, gzip 343.12 kB), while build succeeded. Treat prior zero-warning statements as superseded by this direct evidence.
- Closed the debug panel without dismissing logs; preserved Mobile portrait state. Next: manually verify Title focus without changing text, then other responsive modes; investigate Preview warnings before declaring runtime QA complete.

### 2026-09-05 — Mobile focus pass and handoff

- Mobile portrait Title focus passed without changing its value；visual collision remains resolved。
- Pending：Markdown export clickability，Mobile landscape，Tablet portrait／landscape，Preview warning assessment，and missing RBAC role scripts。
- Prior per-modality GPT-6 Astra low／GPT-5.6 medium switching request is cancelled。
- First handoff patch failed atomically due Markdown marker parsing；no partial edit。

### 2026-09-05 — Normal-user responsive Preview QA closed

- `JournalEditor` responsive header reservation is now verified in Mobile portrait、Mobile landscape、Tablet portrait、Tablet landscape、and current screen size。Title focus passed in the constrained Mobile／Tablet layouts without modifying the title。
- Mobile portrait Markdown export produced `qa___normal_summary_test.md` with the expected title、summary、4 takeaways、user reflection、and Gemini response。
- Reloading Preview removed the prior Vite WebSocket error／unhandled-rejection pair；neither error reappeared after reload。
- Firebase Auth App Check reCAPTCHA warnings remain reproducible at the transient Preview `run.app` origin。The configured reCAPTCHA Enterprise domain is the published AI Studio custom domain，so this warning is treated as Preview-origin incompatibility rather than evidence of a production failure。Enforcement remains off。
- No application source or cloud state changed during QA。Normal-user responsive regression is complete；admin／owner flow verification remains a separate blocked workstream because the role scripts are missing and no privileged account has been established。

### 2026-09-05 — RBAC command-layer packaging repair

- Restored `scripts/bootstrap-owner.ts` and `scripts/manage-role.ts` from two byte-identical preserved local sources after confirming their imported RBAC／Firebase Admin modules and `package.json` match the current candidate。
- The commands remain server-side operational tools and are not part of the browser bundle。They require explicit one-time process inputs and reject when those inputs are absent。
- Current verification：TypeScript pass；production build pass with the existing chunk-size advisory；both no-input CLI invocations rejected with exit `1` before Firebase Admin access。
- No owner or admin role now exists by virtue of restoring these files。Privileged setup、role mutation、and E2E remain separate operations。

### 2026-09-05 — D-drive canonical-candidate verification context

- Repository：`D:\Lessons\Computing_Lessons\Google\Hack2skill (H2S)\Gen AI Academy APAC\Ideathon Challenge\reflective-gemini-journal`。
- Remote：`https://github.com/NNBtw/reflective-gemini-journal.git`。Working branch：`candidate/verified-2026-09-05`，based on `ada36d3`。The assembled candidate is locally committed at `7133301` and remains unpushed。
- Packaging repair added the previously omitted `firebase.json`、Firestore Rules runner，and five suites under `tests/` after dependency equality checks against a preserved verified source。
- Dependency policy：pnpm `allowBuilds` permits `esbuild: true` and explicitly denies `@firebase/util`、`@google/genai`、`protobufjs`、and optional native `re2`。Frozen install passed and retained lockfile SHA-256 `7E6A760F933968BAD42C037F63A09677B0A4B27B36BBD35E0CFC7014DC3FFF4B`。
- Package-manager boundary：retain `bun.lock` for the inherited AI Studio／Bun path and `pnpm-lock.yaml` for canonical frozen validation。Do not refresh either lockfile unless the branch intentionally changes dependencies and reconciles both outputs。
- Local toolchain：Codex bundled Node `v24.19.0` and pnpm `11.19.0` were added only to the active shell PATH。Portable Microsoft OpenJDK `21.0.12.1 LTS` lives outside the repository at `..\tooling\microsoft-jdk-21\jdk-21.0.12.1+1`；archive SHA-256 `192441A9D27DA813BADA974BB88B4CF64D37A9589ED37F204374D411CA5CE07F`。
- Current verification：typecheck pass；production build pass；location `5/5`；security `13/13`；Firestore Rules `30/30`。Expected denial logs in Rules tests are assertions of fail-closed behavior。The Vite `>500 kB` advisory remains non-blocking performance debt（JS `1,246.70 kB`，gzip `343.12 kB`）。
- Secret review：only `.env.example` is a commit candidate；no private key、GitHub token、OAuth secret，or bearer JWT。One Firebase Web client key remains in public Firebase config。Slack／Discord detections are test fixtures。`.firebase-config/` is now ignored after the emulator generated Firebase CLI local state。
- Operator-only command-entry errors：one here-string attempt did not execute and one concatenated output command raised a PowerShell parser error。Neither changed source or invalidated the successful build／test evidence。
- Sandbox-only Git event：a read-only `git -C` inventory check returned `dubious ownership` because CodexSandboxOffline and the user's repository have different Windows SIDs。The user's Git session continued normally；no global safe-directory setting was added。
- Staged hygiene：the first add reported LF-to-CRLF checkout warnings，and `git diff --cached --check` exited `2` for inherited trailing spaces plus one extra EOF blank line。`.gitattributes` now enforces `* text=auto eol=lf`；the listed whitespace was removed without logic changes，and the index was renormalized。
- Two correction attempts failed safely：`.gitattributes` creation was first pasted onto an unsubmitted status command，and a .NET helper interpreted relative paths from `C:\Windows\System32`。No intended source file changed in those failed attempts；the subsequent absolute-path run succeeded。Final staged whitespace check `0`，non-LF index entries `0`，post-cleanup typecheck `0`。
- Commit state：`7133301 Assemble verified Reflective journal candidate` contains 52 files，`20,064` insertions，and `6` deletions；the post-commit working tree was clean。This documentation-only refresh follows that payload commit。
- Next action：commit the refreshed handoff state，fetch／verify `origin`，then push `candidate/verified-2026-09-05`。No merge／deploy／Publish or privileged RBAC operation has occurred。
