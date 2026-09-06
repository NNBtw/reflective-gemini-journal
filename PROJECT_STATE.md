# Reflective 專案狀態快照

> Last updated: 2026-09-06（Asia/Taipei）
> Purpose: cross-session handoff，僅保存目前可執行狀態、證據、blockers 與下一步；完整歷史由專用 logs 與 Git 保存。

## 0. 紀錄作業規範

自 2026-09-06 起，以下規範是本專案的 authoritative documentation workflow：

1. 一個 work stage 內先暫存測試、錯誤、漏洞與變更事件；到 milestone 完成時再統一記錄一次。
2. 每份文件只負責自己的資訊：
   - `README.md`：公開產品入口、demo、功能、架構、安裝／部署、安全設計、限制與 attribution。
   - `development-change-log.md`：程式碼、功能、測試、部署與 tooling chronology。
   - `security-remediation-log.md`：security findings、remediation evidence 與 residual risks。
   - `PROJECT_STATE.md`：目前 handoff snapshot、blockers 與 next actions。
   - `CONTEXT.md`：dated architecture navigation、file ownership 與 invariants。
   - Git commits／PR：authoritative source-change timeline。
3. 只有 Production、安全、部署、資料邊界或重大 blocker 變更，才需要同步更新全部五份文件。
4. 小型工具錯誤只在 milestone 結束時彙整為一筆 development tooling note，不觸發 logging cascade。
5. 一個檔案一次 patch；使用穩定 anchor；完成後只進行一輪一致性、whitespace、link 與 secret verification。
6. 狀態必須明確標記為 `Passed`、`Partial`、`Blocked` 或 `Recommended`；不得把 source inspection 當成 runtime pass。
7. 不記錄完整 API keys、JWT、OAuth secrets、webhook URLs、付款資料、真實日記內容或其他個資。
8. Git publication／merge 狀態以 remote refs 與 PR 為準，不在 README 複製逐筆 commit timeline。

## 1. Current release

| Item | Current state |
|---|---|
| Product | Reflective — Gemini Journal Companion |
| Public app | `https://reflective-journal-ai-companion.ai.studio/` |
| Canonical Cloud Run endpoint | `https://reflective-gemini-journal-companion-516107960247.us-west1.run.app/` |
| Cloud Run service | `reflective-gemini-journal-companion` in `us-west1` |
| Challenge label | `dev-tutorial=cloud-run-ai-challenge` — Passed |
| Firebase／Gemini project | `jimmy-gemini-journal` |
| Firestore database | `ai-studio-d82d6296-0049-4433-955f-91f203831d05` |
| Primary model | `gemini-3.6-flash` |
| Billing | Gemini API Paid Tier activated；project reported `Tier 1 · Prepay` |
| Production status | Published／Ready；first-message persistence remediation verified |
| App Check | Client active；Cloud Firestore `Monitoring / Unenforced` |

The public app and canonical Cloud Run endpoint passed user-operated signed-out／incognito access checks. The public release requires Google sign-in before journal or Gemini access.

## 2. Repository state

- GitHub repository：`https://github.com/NNBtw/reflective-gemini-journal`
- Public `main` current merge commit：`93bba9daf22284eb1681831f0c65e343160475d6`。
- PR `#2` merged the first-message persistence fix and Preview／Production verification records into `main`。
- PR `#3` merged the documentation information-architecture restructure into `main` at `93bba9d`。
- D-drive canonical repository and this isolated checkout are synchronized to that merge commit before the submission-record documentation changes。
- The current submission-record changes affect first-party Markdown documentation only；no application source、dependency、Firebase、Cloud Run、Secrets、billing or Production data was mutated。

## 3. Deployed and verified behavior

### Authentication and API

- Google sign-in uses Firebase Authentication。
- Protected `/api/*` routes apply a pre-authentication IP limiter and verify Firebase ID tokens。
- Token validation checks RS256、certificate key、signature、issuer、audience、expiry、issue time and subject。
- Gemini routes reject missing／invalid authentication before model invocation。
- Public errors are allowlisted；provider、billing and credential details stay server-side。

### Gemini workflow

- Multi-turn modes：reflect、summarize、brainstorm、action items and mindfulness。
- Primary model remains `gemini-3.6-flash`；actual `modelUsed` is returned and persisted with generated messages。
- Conversation input is bounded to 20 messages／16,000 characters。
- Per-user Gemini limit is 20 requests per 60 minutes；fallback is restricted to temporary `429`／selected `5xx` errors。
- Structured summary and three-to-five bounded takeaways are supported。

### Firestore persistence

- Journal path：`/users/{uid}/entries/{entryId}`。
- Security Rules enforce owner isolation、allowed fields、types、bounds、immutable identity fields and safe message transitions。
- Empty journal `0 → 1` first-message transition is explicitly tested and deployed。
- Frontend waits for the first user-message save before starting Gemini；failed final persistence is not reported as success。
- Preferences are owner-scoped；server-only audit／delivery collections reject client access。

### Privacy and product behavior

- Static UI supports English and Traditional Chinese；locale preference stays in browser `localStorage` and is not sent to Gemini。
- Location pinning requires explicit map selection and save；the app never requests device geolocation。
- Coordinates are omitted from Gemini chat／summary payloads and can be removed from the journal and Markdown export。
- Deterministic crisis-support routing runs before Gemini for configured high-risk language；it is not a clinical assessment or emergency service。
- Markdown export keeps user-owned journal content portable。

## 4. Latest release evidence

| Verification | Result |
|---|---|
| TypeScript | Passed |
| Production build | Passed；existing non-blocking large-chunk advisory |
| Location tests | `5/5` Passed |
| Security tests | `13/13` Passed |
| Firestore Emulator Rules tests | `31/31` Passed |
| Firestore Rules compile／deploy | Passed；user-operated release to named database |
| AI Studio Preview first-message save | Passed |
| Preview Gemini response／reload persistence | Passed |
| Preview model metadata | `gemini-3.6-flash` |
| Production page load／demo-account sign-in | Passed without visible error in final submission smoke test |
| Production first-message save | Passed with synthetic content |
| Production Gemini response／reload persistence | Passed；English input produced an English response |
| Production Firestore permission error | None observed |
| Production model metadata | `gemini-3.6-flash` |
| Production Maps consent lifecycle | Load、no automatic device-location request、pin、save、reload、open、remove and second reload Passed；no Maps／API error |

Preview Maps required its separately restricted transient-origin key during testing. The Production key was restored before Republish. Production localization remains Google Maps/browser-default behavior by design.

## 5. Open risks and non-deployed work

### Security residual risks

- `Partial`：Cloud Firestore App Check enforcement remains off pending reliable real-browser compatibility evidence。
- `Partial`：the Firebase Web API key has a Firebase-only API allowlist，but application referrer restrictions remain deferred until all required origins are tested。
- `Partial`：rate limiting is in-memory per Cloud Run process rather than shared across instances。
- `Partial`：expired-session UI behavior has not received the same manual negative-path coverage as missing and malformed tokens。
- `Known limitation`：deterministic crisis matching can miss indirect language or produce false positives。

### Repository candidates not claimed in Production

- Privileged owner／admin RBAC command and UI paths。
- External Gmail、Slack and Discord notification delivery；preferences default off and payloads are designed to exclude journal content。
- Voice input／output and locales beyond `en`／`zh-TW`。

Do not advertise these items as deployed until source synchronization、configuration、publication and human runtime verification all pass.

## 6. Submission state

Challenge deadline recorded from organizer evidence：`2026-09-06 23:59 IST`，equivalent to `2026-09-07 02:29 Asia/Taipei`。

| Submission gate | State |
|---|---|
| Track | `Ideathon Challenge` selected — Passed |
| Working Prototype | Public app URL entered — Passed；canonical Cloud Run URL remains available |
| Demo Social Post | `https://lnkd.in/p/g2PDpeEi` — user verified signed-out access、video playback and required hashtag |
| Public repository | `https://github.com/NNBtw/reflective-gemini-journal` entered — Passed |
| Brief description | Entered — Passed |
| Service checkboxes | All five selected — Passed |
| Final Submit | **Submitted**；user-confirmed dashboard status at 2026-09-06 10:09（Asia/Taipei） |

The Production UI displays `ReflectAI` while the repository title uses `Reflective`。This is a non-blocking branding-consistency follow-up；do not introduce a deadline-adjacent UI change solely for naming。

The recording uses synthetic content and an isolated demo account. No password、OTP、recovery detail、API key、Cloud Console secret or real journal content may appear.

## 7. Next actions

1. User reviews the docs-only PR，then decides whether to merge。
2. After merge，verify anonymous access to repository root、`README.md` and `firestore.rules` on public `main`。
3. Finish the form brief and select only accurately used services：Firebase Authentication、multi-turn Gemini、user-isolated Firestore、Secret Manager，plus `Others` only with deployed custom features described。
4. Perform the final field review，then the user manually presses `Submit`。

## 8. Canonical file map

- `README.md`：public project overview and reproducibility guide。
- `server.ts`：Express server、auth boundary、rate limits、Gemini routes and runtime configuration。
- `src/App.tsx`：authenticated application state and Firestore persistence boundary。
- `src/components/JournalEditor.tsx`：conversation、summary、export and persistence UI flow。
- `src/components/LocationPicker.tsx`：consent-based map selection。
- `src/lib/firebase.ts`：Firebase client、App Check and owner-scoped data access。
- `firestore.rules`：Firestore authorization and schema rules。
- `firebase.json`：named-database Rules deployment and Emulator configuration。
- `tests/`：Rules、security、location and safety-resource tests。
- `development-change-log.md`：complete engineering chronology。
- `security-remediation-log.md`：complete security chronology and residual-risk evidence。
- `CONTEXT.md`：architecture navigation and invariants。

## 9. Handoff instruction

New collaborators should read，in order：

1. `PROJECT_STATE.md` for current status and next actions。
2. `CONTEXT.md` for architecture and safety-critical boundaries。
3. `README.md` for public product and reproduction instructions。
4. The two logs only when historical evidence is needed。

Before changing code，confirm the active branch、working-tree cleanliness、deployed-versus-repository boundary and whether the requested action permits local edits、cloud mutation or external publication.
