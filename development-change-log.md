# Development Change Log

> Last curated: 2026-09-06（Asia/Taipei）
> Scope: chronological product、code、test、deployment and developer-tooling record. Security rationale and residual risk belong in `security-remediation-log.md`; current handoff state belongs in `PROJECT_STATE.md`.

## How to use this log

- Record one entry per completed milestone rather than one entry per command.
- Include changed files or components、observable behavior、verification results and deployment status.
- Aggregate non-product tool failures under a single `Tooling notes` item for the milestone.
- Use `Passed`、`Partial`、`Blocked` and `Recommended` explicitly.
- Never record complete keys、JWTs、OAuth credentials、webhook URLs、payment data、real journal content or user-identifying test data.
- Historical pre-curation wording remains recoverable from Git at commit `b07f9710b54755cc3a90a04e2cb6a80f42d17ff3`.

## Current engineering baseline

- Public Production：`https://reflective-journal-ai-companion.ai.studio/`。
- Canonical Cloud Run endpoint：`https://reflective-gemini-journal-companion-516107960247.us-west1.run.app/`。
- Public repository：`https://github.com/NNBtw/reflective-gemini-journal`。
- Primary runtime model：`gemini-3.6-flash`。
- Latest released defect remediation：empty journal first-message persistence boundary。
- Latest verified local matrix：TypeScript Passed；build Passed；location `5/5`；security `13/13`；Firestore Rules `31/31`。
- Browser-based Preview and Production checks are user-operated unless stated otherwise。
- Privileged RBAC and external notification paths in the repository are local candidates，not verified Production features。

## 2026-09-03 — Authenticated AI backend and security baseline

### Product and code changes

- Replaced UI-only trust with authenticated Cloud Run API access。
- `src/lib/api.ts` and chat／summary callers send a Firebase ID token as `Authorization: Bearer`。
- `server.ts` verifies Firebase token signature and claims before protected API routes can reach Gemini。
- Added fixed client-safe error codes，request bounds，per-IP／per-user rate limits and retryable-only model fallback。
- Added response headers that disable framing、MIME sniffing and unused browser permissions。
- Added deterministic crisis-language routing before Gemini generation。
- Added Firebase App Check client initialization through reCAPTCHA Enterprise；enforcement was intentionally kept separate from client activation。

### Verification

- Missing credentials rejected before Gemini use — Passed。
- Structurally malformed tokens mapped to fixed authentication failures after remediation — Passed。
- TypeScript and Production build — Passed。
- Dependency audit and source secret scan — Passed after dependency overrides and false-positive review。
- Certificate-matched invalid-signature live case — Partial；local TLS certificate retrieval prevented that one runtime variant，while structural and claim checks passed。

### Tooling notes

- Preview App Check warnings on transient AI Studio origins were classified separately from public-domain behavior；they did not justify automatic source modification。
- Earlier archive checkpoints with superseded code were retained outside the canonical repository until the verified candidate was assembled。

## 2026-09-03 — Structured reflection summaries and safe persistence

### Product and code changes

- Added authenticated `POST /api/summarize` with structured JSON output、bounded summary text and three-to-five takeaways。
- Added the Insights card、summary action、loading／error states and Firestore persistence through the existing journal update boundary。
- Added Markdown export of conversation、summary and takeaways。
- Reworked transcript truncation to preserve the newest message while respecting the 16,000-character bound。
- Replaced raw Firebase／provider error display with a fixed user-facing allowlist。
- Preserved existing summary data when a retryable summary request fails。

### Preview verification

- Normal summary generation — Passed。
- Summary and takeaway persistence after reload — Passed。
- Markdown export containing summary and takeaways — Passed。
- Long newest-message crisis path — Passed；normal generated Insights suppressed。
- Duplicate summary-click protection — Passed。
- Offline summary error、existing-data preservation and recovery — Passed。
- Sign-out boundary and same-account restoration — Passed。
- Two-account journal isolation — Passed。
- Expired-session UI negative path — Not independently completed。

## 2026-09-03 — English／Traditional Chinese UI localization

### Product and code changes

- Added typed `en` and `zh-TW` dictionaries、`LanguageContext` and a reusable selector on signed-out and signed-in surfaces。
- Stored the selected UI locale in versioned browser `localStorage` only。
- Localized static controls、dates、accessibility labels and Markdown role／model labels。
- Kept locale out of `/api/chat` and `/api/summarize` payloads；Gemini response language continues to follow user content naturally。
- Voice input／output and additional locales were explicitly deferred。

### Verification

- Signed-in and signed-out switching、reload persistence and keyboard selection — Passed。
- Visible keyboard-focus remediation — Passed in Preview。
- Existing journal and Gemini content remained untranslated when only the UI locale changed — Passed。
- Direct incremental Firestore or paid translation／speech calls — None added。
- Locale preference roaming across devices — Not supported by design。

## 2026-09-04 — Responsive interaction remediation

### Findings and code changes

- Responsive QA found AI Lens/sidebar collisions、an oversized mobile composer、editor-header overlap and an unusably short conversation-history viewport in landscape。
- Added an accessible localized composer collapse／expand action that preserves draft text。
- Moved the collapse control outside the horizontally scrollable AI Lens option region and retained touch pan／desktop scroll behavior。
- Corrected editor-header wrapping for tablet portrait and mobile landscape。
- Replaced invalid Tailwind `landscape:max-h-[500px]:*` candidates with supported `landscape:max-lg:*` variants in `Sidebar.tsx`。

### Verification

- Desktop、phone portrait／landscape and tablet portrait／landscape layout — Passed after remediation。
- Composer state preservation、AI Lens interaction、sidebar history scrolling and title focus — Passed in user-operated Preview tests。
- Fresh export source、compiled CSS、TypeScript and Production build — Passed。

### Tooling notes

- An initial AI Studio Sidebar attempt was canceled and failed live QA because the generated Tailwind variant was invalid despite a successful build。It was rejected rather than published。
- A later single-line AI Studio replacement briefly corrupted the target line；the user restored it before final verification。

## 2026-09-04 — Firestore Emulator and transition validation

### Test infrastructure

- Added `firebase.json` with the named Firestore database and local Emulator configuration。
- Added `tests/firestore.rules.test.ts` and `scripts/test-firestore-rules.ps1` using a synthetic `demo-*` project，local Firebase CLI and Java 21。
- Added package scripts and development dependencies for Rules、location and security testing。

### Defect and remediation

- Initial Rules matrix：`14/15` Passed；a valid 20-message entry exceeded Firestore's 1,000-expression evaluation limit。
- Replaced full-history revalidation with bounded transition validation：initial 0–2 messages；unchanged history；one validated append；or one-message rolling update at the 20-message cap。
- Added frontend trimming to prevent a 21-message persistence attempt。
- Expanded the suite to cover ownership、schema、nested messages、summaries、immutability and denied bulk replacement。

### Verification

- Firestore Emulator after first remediation：`21/21` Passed。
- TypeScript、Production build、dependency audit and source secret scan — Passed。

### Tooling notes

- First Emulator launch was blocked by a sandbox-inaccessible Firebase config path；project-local ignored configuration resolved it。
- A sandbox-specific `tsx` user-info failure occurred before assertions；the suite moved to Node's built-in TypeScript test support。

## 2026-09-04 — Consent-based Google Maps location tagging

### Product and code changes

- Added `LocationPicker.tsx`、`src/lib/location.ts` and lazy Google Maps JavaScript loading。
- Added authenticated `GET /api/maps-config` with `no-store` behavior and bounded rate limiting。
- Added optional Firestore `location` containing only latitude、longitude and optional bounded label。
- Added explicit pin、save、reload、open-in-Google-Maps and remove behavior。
- Added location output to Markdown only while a pin exists。
- Added a model instruction and request boundary that excludes coordinates from Gemini。
- No browser/device geolocation request was introduced。

### Verification

- Location unit tests：`5/5` Passed。
- Firestore location allow／deny matrix — Passed。
- Preview pin／save／reload／remove — Passed with the separately restricted Preview key。
- Removed-state and positive-state Markdown export — Passed。
- Production Maps load、pin persistence and cleanup — Passed。

### Tooling and runtime notes

- Preview initially returned `/api/maps-config` HTTP `200` but Maps rejected the Production key with `RefererNotAllowedMapError` because the transient Preview origin was not allowlisted。
- A dedicated Preview key restricted to the exact transient origin resolved QA；the Production key was restored before publication。
- An earlier AI Studio Secrets row used the credential display name rather than the required environment-variable name and omitted the Map ID row；manual mapping corrected the runtime configuration。

## 2026-09-04 — RBAC, notifications and regional safety candidates

### Repository code

- Added typed user／admin／owner roles and server-side authorization gates。
- Added bootstrap-owner and managed-role command scripts with explicit confirmations、reason bounds、recent-auth checks and idempotency controls。
- Added server-only audit writes and denied client access to audit collections。
- Added opt-in notification preferences and generic Slack、Discord and Gmail delivery adapters designed to exclude journal content、summaries、location and crisis text。
- Added deterministic India、Taiwan and global safety-resource selection without GPS or model inference。

### Verification and deployment boundary

- RBAC tests：`4/4` Passed。
- Notification tests：`5/5` Passed。
- Crisis-resource tests：`4/4` Passed。
- Combined security suite：`13/13` Passed。
- Required CLI files were restored and package scripts verified in the canonical candidate。
- Privileged RBAC and external notification runtime behavior — **not verified in Production and not advertised as deployed**。

## 2026-09-05 — AI Studio synchronization and canonical candidate

### Source synchronization

- Reconciled the latest verified local source with AI Studio while preserving platform-managed configuration。
- Manual AI Studio synchronization passed source checks、TypeScript and Production build after a blocked automated attachment path。
- Downloaded the post-sync archive and verified intended files、configuration boundaries and no unexpected dependency changes。

### Repository assembly and validation

- Assembled the verified 52-file canonical candidate on the D drive。
- Added `.gitattributes` with LF normalization and cleaned only confirmed trailing-whitespace／EOF issues。
- Restored Rules、security and operational test files that were missing from an earlier package。
- Validation：TypeScript Passed；Production build Passed；location `5/5`；security `13/13`；Rules `30/30` at that checkpoint。
- Created candidate commits `7133301` and `a438eac`，then published `candidate/verified-2026-09-05`。

### Tooling notes

- Local user shell initially lacked directly callable Bun／pnpm and child-process Node resolution；a process-local bundled toolchain completed verification without global environment changes。
- First staging exposed inherited line endings and whitespace；normalization resolved `git diff --cached --check` without logic changes。
- A sandbox ownership mismatch blocked one read-only Git inventory；command-scoped safe-directory handling was used later rather than changing global Git configuration。

## 2026-09-05 — Billing migration and Production continuity

- Created a Google Cloud budget alert as monitoring；it is not a hard spending cap。
- Changed the project Billing Account through user-operated Cloud Console steps。
- Verified Firebase remained on Blaze and the published app continued to load。
- Production landing、existing authentication、Firestore journal list／read and Maps load passed after the billing-account change。
- No application code、model order、key value、Firestore Rules or Production data was changed in this milestone。

## 2026-09-05 — Challenge eligibility and public repository

- Verified Cloud Run service `reflective-gemini-journal-companion` in `us-west1` and exact label `dev-tutorial=cloud-run-ai-challenge`。
- Recorded both Cloud Run default endpoints and the AI Studio custom domain mapping。
- Signed-out public access passed for the canonical default endpoint and custom domain。
- GitHub secret scanning flagged the committed Firebase Web client key。The unused API allowlist entries were removed manually，Production reads remained healthy，and alert `#1` was dismissed as `Won't fix` with an audit explanation。Security analysis is in `security-remediation-log.md`。
- Documentation commit `df0c479` completed candidate verification records。
- PR `#1` merged the verified candidate into `main` as `20a8bc1`。
- Anonymous access to repository root、`README.md` and `firestore.rules` passed。

### Tooling notes

- One reminder automation attempt failed safely and the user retained a manual deadline plan。
- Several PowerShell formatting／reporting attempts produced parser or null-display errors after underlying builds or scans had already completed；corrected read-only reruns established the recorded results。
- External GitHub／Cloud Run fetch helpers occasionally returned cache or URL-safety failures；these were not treated as application failures and were followed by user-operated anonymous checks。

## 2026-09-06 — Gemini Paid Tier activation

### Investigation

- A pre-recording request returned `AI_RATE_LIMITED` while the local app bucket still showed 19 remaining requests。
- Cloud Run logs showed the entire deployed model fallback chain returning `429` despite low visible RPM／TPM／RPD use。
- Project inspection then identified `Prepay required` on the newly associated Billing Account，superseding the initial shared-capacity hypothesis。

### Resolution

- User completed Prepay setup manually；AI Studio reported Gemini API Paid Tier activated and project status `Tier 1 · Prepay`。
- The primary model remained `gemini-3.6-flash`；no retry algorithm、fallback order or credential was changed。
- A controlled Production request subsequently returned a successful Gemini response with `modelUsed = gemini-3.6-flash`。

### Tooling notes

- The first isolated clone attempt hit Git ownership protection and made no checkout。A command-scoped safe-directory retry succeeded without changing global Git settings。
- A smoke test was initially performed under the wrong cached browser account；it was excluded from privacy-sensitive release evidence and the correct isolated demo account was used for the controlled regression。

## 2026-09-06 — Empty-entry first-message persistence remediation

### Defect evidence

- The correct demo account reproduced `Missing or insufficient permissions` when a blank journal attempted its first message save。
- A new frontend-shaped Emulator case reproduced an `Index out of bound` Rules evaluation for the `0 → 1` message transition。
- Root cause：`hasValidMessageTransition` evaluated an invalid `messages[0:0]` slice when previous message count was zero。

### Code changes

- `firestore.rules` now handles an empty previous list explicitly and validates `nextMessages[0]` directly。
- `src/App.tsx` update flow returns success／failure from persistence。
- `src/components/JournalEditor.tsx` starts Gemini only after the first user message saves and does not claim chat／summary success when final persistence fails。

### Local verification

- New failing case before fix：30 Passed／1 Failed with the exact index error。
- Firestore Rules after fix：`31/31` Passed。
- TypeScript — Passed。
- Location tests — `5/5` Passed。
- Security tests — `13/13` Passed。
- Production build — Passed with the existing non-blocking large-chunk advisory。
- Diff hygiene and focused secret scan — Passed；fixture-only webhook patterns were not treated as live secrets。

## 2026-09-06 — Rules release, Preview QA and Production regression

### Deployment and synchronization

- User-operated Firebase CLI deployment compiled、uploaded and released `firestore.rules` to project `jimmy-gemini-journal` and the named Firestore database。
- User manually synchronized exactly `src/App.tsx` and `src/components/JournalEditor.tsx` to AI Studio。
- AI Studio reported TypeScript and Production build Passed。
- User manually Republished；AI Studio status returned `Ready`。

### Runtime verification

- Preview first user-message save — Passed。
- Preview Gemini response — Passed。
- Preview persistence after reload — Passed。
- Preview Firestore permission error — None。
- Preview model metadata — `gemini-3.6-flash`。
- Production first-message save — Passed。
- Production Gemini response — Passed。
- Production persistence after reload — Passed。
- Production Firestore permission error — None。
- Production model metadata — `gemini-3.6-flash`。
- Production Maps load — Passed。

### Release result

- First-message persistence remediation — **Passed in Production**。
- Maps localization remains browser-driven because the loader intentionally omits forced `language`／`region` parameters。
- Fix branch commits `4205033`、`bd71382` and `d0970a8` were merged by PR `#2`；public `main` became merge commit `b07f9710b54755cc3a90a04e2cb6a80f42d17ff3`。
- D-drive canonical `main` was synchronized to the same commit and verified clean。

## 2026-09-06 — Submission preparation

- Published a public LinkedIn demo post containing `#AccelerateAIwithCloudRun` at `https://lnkd.in/p/g2PDpeEi`。
- User-operated signed-out verification passed post visibility、video playback、required hashtag and no-login access。
- Submission form：`Ideathon Challenge` selected；public app URL entered；social link ready；repository、brief、service confirmation and final submission remain pending。
- LinkedIn recompression made small UI text less clear。Recommended adding a high-resolution YouTube copy while retaining the LinkedIn post as the required social-post URL；this is optional and does not change application state。

## 2026-09-06 — Documentation information architecture restructure

### Documentation changes

- Replaced the 567-line log-heavy `README.md` with a public project entry organized around live links、starter-project differentiation、deployed features、architecture、security／privacy、reproduction、deployment、limitations and attribution。
- Replaced the chronological `PROJECT_STATE.md` with a concise current handoff snapshot containing authoritative logging rules、release／repository state、verified evidence、residual risks、submission state and next actions。
- Replaced the dated-log-heavy `CONTEXT.md` with a current architecture map covering runtime flows、source ownership、data model、API contracts、configuration、safety invariants and verification routing。
- Curated this file into milestone-based feature／code／test／deployment history with aggregated tooling notes。
- Curated `security-remediation-log.md` into stable finding IDs with remediation、evidence、deployment boundary and residual-risk status。
- Removed duplicated historical narratives from snapshot documents without deleting evidence：the pre-curation versions remain in Git at `b07f9710b54755cc3a90a04e2cb6a80f42d17ff3`。
- Application source、dependencies、lockfiles、Firebase configuration、Rules、Cloud Run、Secrets、billing and Production data were unchanged。

### Verification

- Markdown files：exactly five first-party files inventoried and assigned distinct roles。
- Local Markdown links：0 missing targets。
- Stale `outputs/...` document paths and superseded status phrases：0 matches in the curated set。
- Focused documentation secret patterns：0 matches。
- TypeScript：Passed，exit `0`。
- Location tests：`5/5` Passed。
- Security tests：`13/13` Passed。
- Production build：Passed，2,271 modules；client `1,246.80 kB`／gzip `343.11 kB`；existing non-blocking large-chunk advisory retained；server bundle completed。
- Firestore Emulator Rules：`31/31` Passed against synthetic project `demo-reflective-rules`；deny-path `PERMISSION_DENIED` output was expected assertion evidence。
- Final whitespace、link、secret、status-consistency and Git diff checks — Passed；`git diff --check` exit `0`。

### Tooling notes

- The first whole-file `apply_patch` attempted delete and add for the same path in one patch and was rejected before any change。Separate atomic delete／add patches succeeded。
- Initial sandboxed Production build repeated the known ancestor-directory access denial and could not load `vite.config.ts`。The identical approved local command outside that restriction passed；no source or configuration workaround was introduced。
- Documentation payload commit `a33e558` was synchronized to the D-drive canonical repository and pushed to GitHub branch `docs/documentation-restructure-2026-09-06`。Remote `main` remained `b07f971` and was not merged or modified。
- The first post-push blob-verification command repeated the known PowerShell parser error caused by piping directly from `foreach`；it stopped before executing any Git comparison and changed nothing。The variable-first retry passed：isolated／D-drive branch hashes matched，all five document blob hashes matched，ancestry from `main` passed and both working trees were clean。
- The first `PROJECT_STATE.md` publication-status patch used two dependent hunks in the wrong context order and was rejected atomically。A single contiguous current-state patch then succeeded；no partial or duplicate status line was created。
