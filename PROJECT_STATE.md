# 專案狀態快照（PROJECT_STATE.md）

## 1. 專案目標與整體架構

專案名稱：**Reflective — Gemini Journal Companion**

公開網址：
https://reflective-journal-ai-companion.ai.studio

GitHub Repository：
https://github.com/NNBtw/reflective-gemini-journal

這是一個採用 security-first 設計的 AI 反思日誌應用程式。使用者可透過 Firebase 登入，與 Gemini 進行多輪反思對話，並將摘要與日誌儲存至個人 Firestore 空間。

此應用程式用於支持自我反思與尋求協助，不能取代醫療照護、心理治療、診斷或自殺防治服務。

主要技術：

- TypeScript
- React 19
- Vite
- Express 5
- Firebase Authentication
- Cloud Firestore
- Firebase App Check
- Gemini API
- Google Cloud Run
- Google Cloud Secret Manager

---

## 2. 已完成與驗證的內容

### Authentication 與 API 保護

- 已實作 Firebase ID Token 的後端驗證。
- 驗證內容包含：
  - RS256 signature
  - `kid`
  - issuer
  - audience
  - expiry time
  - issued-at time
  - authentication time
  - Firebase UID
- `/api/chat` 與 `/api/summarize` 均需要有效的 `Authorization: Bearer <token>`。
- 公開環境未登入呼叫 `/api/chat` 已驗證回傳：

```json
{
  "error": "Authentication required.",
  "code": "AUTH_REQUIRED"
}
```

HTTP Status 為 `401`，代表受保護 API 已正式上線。

### Gemini API 安全措施

- Gemini API key 僅由 server-side environment／Secret Manager 取得。
- 原始碼未發現 hardcoded Gemini API key、private key 或 OAuth client secret。
- 已加入：
  - 每個使用者每小時最多 `20` 次 Gemini requests
  - Pre-auth IP rate limiting
  - Request body 上限 `128 KB`
  - Message、history 與 output 長度限制
  - 僅針對 `429`、`500`、`502`、`503`、`504` 執行 fallback

### Crisis Safety

- 已加入 deterministic crisis response。
- 偵測到明確自傷或自殺字詞時：
  - 不呼叫 Gemini API
  - 直接顯示安全回應
  - 提供台灣求助資源：`110`、`119`、`1925`、`1995`、`1980`
- 應用程式不宣稱能診斷、治療憂鬱症或預防自殺。

### Firestore Data Isolation

Firestore Project：

```text
jimmy-gemini-journal
```

Firestore Database：

```text
ai-studio-d82d6296-0049-4433-955f-91f203831d05
```

已完成並發布 Firestore Security Rules：

- 每位使用者只能讀寫自己的資料。
- 驗證 document owner 與 authenticated UID。
- 加入 schema、資料型別與欄位大小限制。
- `id`、`userId`、`createdAt` 建立後不可修改。
- 已移除不必要的 `interactions` client write surface。
- Firebase Console 已確認 Rules publish success。

### Frontend 保護

`JournalEditor` 已完成：

- 自動取得 Firebase ID Token。
- 以 Bearer Token 呼叫後端。
- 限制 title、tags、messages 與 history 長度。
- 未登入時不允許呼叫受保護 API。

### Dependency 與 Build 驗證

- Express 已升級至 `5.2.1`。
- `qs` override 已更新至 `6.16.0`。
- SPA fallback route 已改為 Express 5 相容語法：

```ts
app.get('/{*splat}', ...)
```

- `tsc --noEmit` 已通過。
- Dependency audit 已檢查 `450` 個套件，結果為 `0 advisories`。
- Secret scan 未發現 server-side secret 洩漏。
- Firebase Web API key 與 reCAPTCHA site key 屬於 public client configuration，不是 Gemini server API key。

### 文件

已完成：

- Human-written、第一人稱 README
- Security remediation log
- Codelab attribution
- 已知限制與 safety disclaimer
- 部署與環境變數說明

---

## 3. 關鍵資料型別

```ts
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type ReflectionMode =
  | 'free'
  | 'gratitude'
  | 'challenge'
  | 'growth'
  | 'brainstorm';

export interface JournalMessage {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  mode: ReflectionMode;
  messages: JournalMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AIResponsePayload {
  reply: string;
  summary?: string;
  title?: string;
  tags?: string[];
  crisisDetected?: boolean;
}
```

---

## 4. 尚未完成與下一步

### 0. Reflection Summary backend checkpoint（尚未發布）

- 2026-09-03 已在 Google AI Studio 完成 backend-only 的 product-alignment checkpoint。
- 僅修改 AI Studio source 的 `server.ts`（`+51 / -4`）；其他 20 個檔案未變。
- `POST /api/summarize` 的正常回應改為經 server-side 驗證與長度限制的 `{ summary, keyTakeaways }`。
- AI Studio 回報 `tsc --noEmit` 零錯誤、production build 成功，並建立 checkpoint。
- 既有 authentication、App Check、rate limits、request limits、model fallback、error redaction、security headers 與 crisis pre-check 均未被修改。
- 此結果目前 **尚未 Publish**，也 **尚未重新匯出到 `work/reflective-gemini-journal/`**，因此不可宣稱 public deployment 或 local independent verification 已完成。
- 第二個 AI Studio checkpoint 已修改 `JournalEditor.tsx`（`+308 / -2`），加入 authenticated summary request、`onUpdateEntry` persistence、Insights card、accessible status／crisis UI 與 Markdown export；AI Studio 顯示 `Built`。
- Review 發現目前以 `.slice(0, 16000)` 截斷合併後的對話，長對話可能捨棄最新訊息，讓最新 crisis language 無法送達 backend safety check。
- catch path 也可能把 Firebase SDK 的原始 `err.message` 顯示給使用者。
- 第三個 focused remediation checkpoint 已修正上述兩點：`buildBoundedTranscript` 保證保留最新 user message，再由新到舊填入剩餘 16,000 字元預算並恢復 chronological order；錯誤顯示改為固定 allowlist，unknown error 使用 generic fallback。
- 此 remediation diff 僅修改 `JournalEditor.tsx`（`+131 / -34`），實際程式碼 review 已通過。
- AI Studio 回報 `tsc --noEmit` 零錯誤、Vite + esbuild production build 成功，並建立 checkpoint。
- 最新 AI Studio candidate 已下載至 `work/reflective-gemini-journal-export-2026-09-03/`，ZIP SHA-256 為 `C2689BB21792A355F90BC494FFF3C9A4D68D309A5FCBFE816321DFBD950C29DD`；舊 local source 尚未覆寫。
- 第一份 candidate 的 TypeScript、Vite production build、server bundle、dependency audit、source secret scan 與基本 auth smoke tests 已通過；後續更嚴格的 malformed-token case 在 post-remediation export 發現下述分類缺陷。
- 後續 AI Studio unpublished checkpoint 僅修改 `firestore.rules` 與 `src/components/JournalEditor.tsx`，已在 code-review level 修正 nested list validation 與 general-chat raw/persisted error 兩項 findings。
- 目前狀態為 **主要 Preview manual tests、general-chat remediation／negative-path、latest candidate 的 build／audit／secret scan、malformed-JWT local regression，以及 Firestore Emulator Rules matrix 均已通過；expired-session UI、Rules deploy 與 Publish 後 regression 仍待完成**。
- 已通過：正常 summary、refresh persistence、Markdown export、超過 16,000 字元且最新 user message 含 synthetic crisis phrase、summarizing 時的 UI duplicate-click protection、summary 與 general-chat offline allowlisted errors、general-chat retry／non-persistence、sign-out UI access boundary／same-account re-authentication，以及兩個 controlled accounts 的雙向 journal isolation。
- 發布前仍需測試：expired session。Firestore Rules 的直接 allow／deny 驗證已由 local Emulator matrix 補足，但尚未 deploy。
- `firestore.rules` 現已透過 transition validation 支援最多 10 tags、20 messages 與 3–5 takeaways；general chat error 現為固定 transient alert、static log 且不再寫入 messages。Rules source review 與 21-case Emulator suite 均通過，但尚未 deploy。
- General-chat deliberate offline QA 顯示固定訊息 `Unable to complete AI reflection. Please try again.`；原 user reflection 保留，無錯誤 Gemini bubble 或技術細節，重新連線後 Retry 成功且未重複 user message，refresh 後沒有 persisted operational error。
- Error banner 實測只明顯看到 Retry；post-remediation source 確認右側另有 `×` 且 `aria-label="Dismiss chat error"`。這是 icon-only control 不易辨識的非阻斷性 UX observation，不影響 error redaction、retry safety 與 data-integrity 驗收。
- Post-remediation ZIP 已重新命名為 `C:\Users\User\Downloads\reflective-gemini-journal-post-chat-remediation-2026-09-03.zip`，SHA-256 為 `985B05FA8C08C0A49E12DA76EF25CA0FC3E86620F1EDB7AA91710B5DFE06B574`，並解壓至 `work/reflective-gemini-journal-post-chat-remediation-2026-09-03/`，未覆寫舊 snapshot。
- 新 export 的 source diff 符合預期，只變更 `firestore.rules` 與 `src/components/JournalEditor.tsx`；TypeScript、frontend/server production builds、dependency audit、supply-chain lockfile check 與 source secret scan 通過。
- Auth smoke test 發現新 blocker：unparseable three-segment JWT 會讓 `decodeJwtPart()` 的 JSON parsing exception 落到 sanitized `500 INTERNAL_ERROR`，而不是 `401 INVALID_TOKEN`。沒有 auth bypass，也未呼叫 Gemini，但 publish 前應將所有 decode／parse failure 映射為固定 `401 INVALID_TOKEN` 並回歸測試。
- 後續 unpublished AI Studio checkpoint 僅修改 `server.ts`（`+15 / -1`）。實際 diff review 確認 decode／JSON parsing、non-object decoded value 與 signature verification exception 均映射為固定 `401 INVALID_TOKEN`，並保留所有既有 auth invariants；AI Studio 回報 TypeScript 與 production build 通過。
- Post-auth export 已下載並完成 local regression；原本的 `abc.def.ghi` 現正確回傳 `401 INVALID_TOKEN`，此 finding 已在 local candidate 關閉。尚未 deploy 或 publish。
- Post-auth ZIP：`C:\Users\User\Downloads\reflective-gemini-journal-post-auth-remediation-2026-09-03.zip`；SHA-256：`D74A136A9C04090C1197E3C78BA54CF1A2C3011A9C658211B9B4B2E87F9C75D0`。
- Latest staging：`work/reflective-gemini-journal-post-auth-remediation-2026-09-03/`。TypeScript、frontend/server builds、dependency audit、supply-chain lockfile check、source secret scan 與 malformed-token matrix 通過。
- certificate-matched invalid-signature runtime case 因本機 PowerShell TLS 無法取得 Google public certificates 而未完成；signature exception mapping 僅以 source review 確認，不可誤稱 dynamic pass。

### A. Firebase App Check client 已在公開版本生效

已完成：

- 啟用 reCAPTCHA Enterprise API。
- 建立 `reflective-journal-app-check` key。
- Domain restriction 設為：

```text
reflective-journal-ai-companion.ai.studio
```

- Firebase Web App `ai-studio-applet-webapp` 已成功註冊 App Check。
- Public site key 已加入 AI Studio source 與 local export。
- 使用者於 2026-09-03 親自執行 `Republish`，發布流程完成並回到 `Status Ready`。
- 這次沒有再次出現 `Failed to generate API key, The request is suspicious.`。
- 公開 bundle 已由 `index-DlfZi7qZ.js` 更新為 `index-DHYh_8uw.js`。
- 公開頁面已載入 reCAPTCHA Enterprise client script，因此 App Check client activation 已確認上線。
- 使用者完成登入後的公開版本 smoke test，並回報運作正常。
- App Check enforcement 目前仍保持關閉。

下一步：

1. 觀察 Firebase App Check legitimate traffic metrics。
2. 完成明確的 signed-in、sign-out 與跨帳號隔離測試。
3. 確認正常流量穩定後，再評估逐步啟用 App Check enforcement。
4. 不要在缺少 metrics 與 rollback 計畫時直接 enforcement。

### B. Signed-in End-to-End Test

使用者已完成公開版本 authenticated smoke test 並回報運作正常。仍需逐項留下證據：

- AI Studio Preview 已以 synthetic entry `QA — Normal Summary Test` 成功建立 journal，完成一輪 Gemini interaction，並顯示非空 summary 與 3 個 takeaways，無可見錯誤。
- Preview 顯示 `Firestore Synchronized 1 doc`；使用者 reload 後確認相同 summary／3 個 takeaways 仍存在，因此 Preview persistence test 已通過。
- 使用者檢查下載的 Markdown export，確認包含 Summary 與全部 3 個 Takeaways，無錯誤訊息。
- 使用者以超過 16,000 字元的 synthetic transcript 測試，最新 user message 的 crisis phrase 仍觸發固定危機提示；畫面包含 `110`、`119`、`1925`、`1995`、`1980`，未產生一般 Reflection Insights，亦無可見錯誤。
- summarizing 期間按鈕呈 disabled，UI duplicate-click protection 通過；未擷取 network trace，因此未獨立核對 backend request count。
- Offline summary update 僅顯示固定訊息 `Unable to generate reflection summary. Please try again.`；既有 Summary 保留、沒有可見技術細節，重新連線後頁面恢復。
- 後續已直接檢查 AI Studio debug panel：summary path 僅記錄固定 `[Summary] Request failed`；其餘 errors 為刻意斷網造成的 Vite WebSocket disconnect，不是 build failure。
- Preview 的 transient `run.app` origin 不在 domain-restricted reCAPTCHA key 中，因此 debug panel 有 App Check token warnings。Enforcement 仍關閉，Preview 操作成功；public domain activation 已另行驗證，不應點 AI Studio `Fix` 來處理這些測試性／環境性訊息。
- Sign out 後回到 Sign in 畫面，Journal 與 Summary 操作均不可見；原帳號重新登入後既有 Journal／Summary 恢復且無錯誤。此結果不等同 forced expired-token 或 cross-account test。
- 兩帳號 Preview 測試已通過：Account B 看不到 Account A 的 isolation marker 或既有 Journal；Account A 重新登入後資料恢復，且看不到 Account B 的 marker。此為 UI E2E 證據，Firestore Rules 的直接 deny assertion 仍待 emulator test。
- 尚未驗證完整多輪情境。
- 登出後無法存取受保護 API。
- 不同帳號之間無法讀取彼此資料。

Summary test 待辦：

- expired/missing session allowlisted error。
- controlled rate-limit response。
- Publish 後 public regression。

不得要求使用者提供密碼、OTP 或 Firebase token。

### C. Firestore Emulator Tests

2026-09-04 交接後確認：這是目前第一個 active engineering workstream。測試必須以最新、尚未部署的 Rules candidate 為準：

```text
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/firestore.rules
```

交接啟動時尚未建立測試環境；2026-09-04 已完成 harness、finding remediation 與 final regression。Automated allowed／denied coverage 包含：

- Owner 可以 create、read、update、delete。
- 非 owner 無法讀取或修改。
- 未登入 request 被拒絕。
- Extra／missing field、錯誤型別、超過 title／tags／messages／summary／takeaways 限制的無效 schema 被拒絕。
- 嘗試修改 `userId`、`id`、`createdAt` 被拒絕。
- 合法的 summary 與 3–5 個 bounded takeaways 可寫入；不一致或超量的 summary／takeaways 被拒絕。

原定第一階段只新增 test harness、Emulator 設定、test script 與必要的 development dependencies；實際測試證明 Rules 存在 expression-limit defect，並同時發現 `JournalEditor.tsx` 在滿額歷史加入 Gemini reply 時可能產生 21 messages 的 off-by-one，因此依 reproducible evidence 做了 focused remediation。

2026-09-04 setup progress：

- 已新增 `firebase.json`、`tests/firestore.rules.test.ts`、package scripts、Firebase CLI `15.28.2` 與 `@firebase/rules-unit-testing` `5.0.2`。
- 已下載 project-local Microsoft OpenJDK `21.0.12.1`；201,096,952-byte ZIP 的 SHA-256 `192441A9D27DA813BADA974BB88B4CF64D37A9589ED37F204374D411CA5CE07F` 與 Microsoft 官方 checksum 一致。沒有 system-wide install 或永久 PATH 變更。
- Firestore Emulator `v1.22.0` binary 已下載。
- `pnpm add` 因 supply-chain policy 未批准 `@google/genai` 與 `re2` lifecycle scripts 而以 `ERR_PNPM_IGNORED_BUILDS` 結束；沒有執行 blanket approval。直接 `tsc --noEmit` 已通過。
- 第一輪 test launch 尚未啟動 Emulator，即因 Firebase CLI 存取 user-level configstore 遭 sandbox `EPERM` 而停止。這不是 Rules pass／fail；下一輪會把 CLI config redirect 至 ignored project-local `.firebase-config/`。
- Redirect 後 Firestore Emulator 已成功啟動，且 CLI 確認 `demo-reflective-rules` 不會存取 non-emulated services；但 `tsx` 在 assertions 前因 Windows user-info call 收到 `uv_os_get_passwd ENOMEM`。Rules scripts 隨後改用 Node 24 built-in TypeScript test runner，並已產生下述 final allow／deny evidence。
- Node built-in runner 的第一個完整 Rules matrix 已執行：15 tests 中 14 passed、1 failed。實際 finding 是合法的 20-message entry 觸發 Firestore Rules 每 request 最多 1,000 expressions 的限制，因而被錯誤拒絕。這表示目前 `firestore.rules` 雖宣稱接受最多 20 messages，boundary 在 runtime 不可用；Rules 尚未通過發布前驗收。
- 當時的 focused remediation 範圍限定為降低 nested message validation 的 expression cost，並補強 invalid mode／model／timestamp 等 regression cases；最終修補沒有弱化 owner isolation、top-level schema、immutable fields 或 20-message product limit。

2026-09-04 final outcome：

- Capacity probe 證明原本逐項重驗整個 array 的 Rules 只在 4 messages 可通過，6 messages 已超過 1,000 expressions；單純 micro-optimization 無法安全支援 20-message product limit。
- `firestore.rules` 改為 transition validation：create 僅允許 0–2 則且逐則完整驗證；update 僅允許 messages unchanged、append one valid message，或滿 20 後 drop-oldest／append-one rolling transition。既有歷史不可 bulk replace、縮短或擴張至 21。
- `JournalEditor.tsx` 的 Gemini reply persistence 加入 `.slice(-MAX_STORED_MESSAGES)`，修正滿額 history 可能寫入 21 messages 的 off-by-one。
- 新增 reproducible runner `scripts/test-firestore-rules.ps1`，自動尋找 Java、使用 ignored local Firebase config，並固定 synthetic project `demo-reflective-rules`。
- Final Emulator matrix：21 tests、21 passed、0 failed。TypeScript、Vite production build、server esbuild bundle 與 production dependency audit 均通過；audit 為 no known vulnerabilities。
- Final source-only secret scan：0 private-key matches、0 Bearer-token matches；只看到既有 public Firebase Web key、Gemini env references 與 placeholder。
- 這些 Rules 與 frontend fixes 目前只存在 local candidate；尚未 deploy／publish，也未寫入 production Firestore。部署前仍需重新匯出／同步策略與使用者明確批准。

### D. Final Export 與公開 Repository

目前 preserved local export：

```text
work/reflective-gemini-journal/
```

早期 summary candidate staging export：

```text
work/reflective-gemini-journal-export-2026-09-03/
```

Post-chat-remediation candidate staging export：

```text
work/reflective-gemini-journal-post-chat-remediation-2026-09-03/
```

Latest post-auth-remediation candidate staging export：

```text
work/reflective-gemini-journal-post-auth-remediation-2026-09-03/
```

Latest responsive-remediation candidate and local verification artifacts：

```text
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/
```

2026-09-04 起，Firestore Emulator work 以此 responsive-remediation export 作為 current local source baseline；不要再以舊的 `work/reflective-gemini-journal/` 作為最新 source，也不要覆寫 preserved snapshots。

此資料夾目前不是 Git repository。

後續需要：

1. 從 AI Studio 重新匯出最終 source。
2. 重新執行：
   - TypeScript check
   - Production build
   - Dependency audit
   - Secret scan
   - Git history scan
3. 更新 README 與 remediation log。
4. 在取得使用者明確批准後，才同步至 public GitHub repository。

目前不可宣稱 GitHub 已完成 final sync。

### E. Cloud Run 注意事項

本機尚未安裝 `gcloud`。

不要在未確認既有 Cloud Run service mapping 前建立新 service，以免產生重複部署或錯誤設定。

### F. Planned Multilingual／Voice Milestone 與 Cost Gate

使用者要求新增：

- 整體 UI language selector。
- multilingual voice input。
- multilingual voice response playback。

最高優先限制：Google Cloud Platform 與 API 的預付總支出不得超過 `NT$400`。

目前決策：

- 尚未開始修改產品 code。
- 不啟用 Cloud Translation、Cloud Speech-to-Text、Cloud Text-to-Speech 或其他新增付費 API。
- 第一版優先採 bundled locale dictionaries、BCP-47 language tags、browser Web Speech recognition 與 browser／OS speech synthesis。
- UI locale 不得傳入 Gemini prompt 或 payload；Gemini 繼續依使用者 journal／reflection 的輸入語言自然回覆。
- 所有 real Gemini QA calls 必須記錄；大部分測試使用 local／mock，禁止 bulk multilingual API calls。
- 一般 Cloud Billing budget alert 不是可靠 hard cap；若未確認 billing headroom，停止任何可能產生費用的實測。

Acceptance boundary：

- 「支援所有官方國家語言」代表提供廣泛 BCP-47 locale 選擇與 feature detection，不代表每個 browser／OS 都有每種 recognition model 或 synthesis voice。
- Recognition unsupported／permission denied 時保留完整 text-input fallback。
- Voice unavailable 時保留可讀文字回應，且不得影響 crisis safety display。
- Microphone 僅能由 direct user gesture 啟動，不保存 raw audio，並須揭露 browser recognition 可能使用 remote vendor service。

已採用的第一個 implementation slice：

- 僅新增 UI language selector 與完整 `zh-TW`／`en` static UI dictionaries。
- 第一次使用依 browser language 選擇；後續以 versioned `localStorage` preference 為準。
- 不翻譯 journal content、Gemini response 或 backend deterministic crisis response。
- 不新增 Firestore field／document／listener／read／write，不新增 backend request、dependency 或 cloud setting。
- 預估 direct incremental API cost 約 `NT$0/month`；voice input／voice response 與其他 locale 延後。
- 狀態：AI Studio 已建立未發布的九個 frontend 檔案 checkpoint；已通過初步 signed-in Preview QA，尚未 export、deploy 或 publish。

Implementation／QA evidence：

- 新增 typed `en`／`zh-TW` dictionaries、`LanguageContext`、`LanguageSelector`，並整合 Landing、Sidebar、App 與 JournalEditor。
- 直接 source inspection 確認 `/api/chat` 維持 `messages`、`mode`、`title`、`tags`、`mood`；`/api/summarize` 維持 `text`、`title`，兩者都沒有 locale／language instruction。
- Signed-in Preview 已通過 `en` 切換 `zh-TW`、靜態 UI 與 accessibility labels／日期時間本地化，以及 reload 後偏好保留。
- 既有英文 reflection 與 Gemini response 在繁中 UI 中保持英文，確認沒有自動翻譯或 post-processing；此次檢查沒有送出 Gemini request。
- `1 error running the code` 來自 transient Preview App Check、Firestore connection 與 Vite WebSocket；reload 後 errors 清除，只剩已知 App Check warning，未使用 AI Studio `Fix`。
- Focused export-label checkpoint 已新增四個 typed translation keys，並在 `handleExportEntry()` 取代 `Reflection`／`Gemini AI`／`Companion`／`N/A` hardcoding；fresh ZIP source diff 已確認。
- 最新 ZIP SHA-256：`AA95348AEE9D83191758D8867C0E5BCEB530383D0B8F5752D8955342DA0DCD60`；staging：`work/reflective-gemini-journal-post-export-label-i18n-v2-2026-09-03/`。
- `server.ts`、Rules、Firebase config、`package.json` 未變；ZIP 內 `bun.lock` 為空 export artifact。AI Studio 回報 typecheck／build 通過，本機獨立 Vite build 因 dependency junction filesystem restriction 尚未完成，不能宣稱 local build passed。
- Signed-out selector 已通過兩種語言、Landing copy、reload persistence、Space／Alt+Down、方向鍵＋Enter 與 no keyboard trap。
- Focus indicator focused remediation 已通過 user-reported manual retest：Landing／Sidebar 均有 visible focus；Space／Alt+Down、方向鍵＋Enter、mouse selection 正常，無 keyboard trap／錯誤。Exact source diff 等下一份 ZIP 再驗證。
- 未完成：browser／blocked-storage fallback、responsive header polish、兩個 bounded cross-language Gemini tests、English／繁中 Markdown export 實檔檢查，以及 focus／responsive remediation export review。
- 2026-09-04 responsive QA：Desktop／English Desktop、Phone portrait、Sidebar toggle 與所有尺寸的 language selector 通過；Phone landscape 與 Tablet portrait／landscape 發生 AI Lens controls 和 entries/sidebar UI overlap。
- Mobile composer 在 landscape 約占一半高度、portrait 約占三分之二，無 collapse control，造成 conversation context 難以查看。需新增 localized accessible collapse/expand、保留 draft／active mode，並調整 Tablet sidebar breakpoint／interaction 後再測。
- 2026-09-04 follow-up Preview：composer collapse／expand 功能正常，原本廣泛的 sidebar/editor collision 已解除。Tablet portrait 與 Mobile landscape 仍有 masked `/users/{uid}/entries` badge 和 `Reflective` mood control 的些微視覺重疊；操作不受影響，屬於待修 cosmetic finding。
- `JournalEditor.tsx` editor-header responsive stacking／wrapping 已完成，且 fresh responsive ZIP 已通過 source/typecheck/build verification；Gemini payload、Firestore operations 與 persisted content 未因 responsive remediation 改動。
- 補充 finding：Mobile portrait／landscape、Tablet portrait／landscape 與 PC 全部都有 AI Lens options 和 composer collapse button 重疊。合併修正仍限 `JournalEditor.tsx`：collapse button 必須位於 non-scrolling fixed area；AI Lens options 使用 bounded horizontal scroll，PC 顯示可用 scrollbar，Mobile／Tablet 可直接在整個 options region 原生 swipe／pan，並保留 keyboard accessibility。
- 後續 user Preview 回報 editor header 與 AI Lens／collapse overlap 均已解決；fresh responsive ZIP 已完成 source verification。
- 2026-09-04 live Preview inspection：Mobile landscape Sidebar 的 history list 可正常上下捲動，但上下固定控制區占用幾乎全部高度，只留下極窄 history viewport。下一步僅修 `Sidebar.tsx` short-height landscape space allocation，保留 language/account/sign-out、focus order、overlay dismiss 與既有 desktop/portrait 行為。
- 第一次 Sidebar remediation live retest 失敗；AI Studio run 顯示 `Canceled`。View differences 確認使用 `landscape:max-h-[500px]:*`，其中 `max-h-[500px]` 是 sizing utility 而非 viewport-height variant，build 可成功但 compact CSS 可能完全未產生。不可採信 summary 宣稱的 `~184 px`／two entries；改用 supported responsive condition 後必須再看 live Preview。
- 2026-09-04 已直接在 AI Studio Code view 修正 `src/components/Sidebar.tsx`，未送出 Gemini prompt：70 個 `landscape:max-h-[500px]:` 全部改為 supported `landscape:max-lg:`，行數不變。第一次 snapshot save 失敗，retry 後在 conflict view 保留 corrected source；另見的 26-file difference 是 initial snapshot 對 current project 的 history comparison，不是此次 edit scope。使用者已在 Mobile landscape Preview 人為確認 cramped history viewport 修復。未 publish／deploy／寫入 Firestore／發出 application Gemini request。
- Fresh ZIP `reflective-gemini-journal-post-responsive-remediation-2026-09-04.zip` 的 SHA-256 是 `F3552FBE2C2F2B6699CBC45D8C6B7A68D5B2F048DA61D52533EB40498F55E18E`。Exported source 為 0 個 invalid、70 個 supported prefix；compiled CSS 確實含 landscape＋below-lg media rule。`tsc --noEmit`、Vite＋server production build、production dependency audit、secret scan 全部通過；只有既有 bundle-size warning。`server.ts`、Rules、Firebase config、`src/lib/firebase.ts` 與 `package.json` 均未變。

Cost／storage clarification：

- Named database `ai-studio-d82d6296-0049-4433-955f-91f203831d05` 是目前 `/users/{uid}/entries/{entryId}` journal documents 的儲存處，不是新語音功能專用資料庫。
- Language preference 存在每個 browser/profile/origin 自己的 `localStorage`；切換語言新增 `0` 次 Firestore read/write，且不得造成既有 realtime subscription 重新建立。
- 其他裝置同樣會從 hosted frontend 取得此功能，但 preference 不自動跨裝置同步；開發者電腦不必保持開機。
- Interim transcript 僅在 React state；raw audio 不保存；使用者按 Send 後才沿用既有 journal persistence。
- Browser speech input/output 本身不新增此 GCP project 的 Cloud Speech／TTS 費用。Locale instruction 僅增加既有 Gemini request 的少量 input tokens，不新增第二次 API request。
- 預期 direct incremental feature cost 接近 `NT$0`；但使用者互動增加仍可能間接增加原有 Firestore、Gemini、Cloud Run 與 network usage。

---

## 5. 重要檔案位置

Current verified candidate source：

```text
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/
```

Preserved historical source（不是目前基準）：

```text
work/reflective-gemini-journal/
```

README：

```text
outputs/README.md
```

Security remediation log：

```text
outputs/security-remediation-log.md
```

## 2026-09-04 — Google Maps pinned-location feature kickoff

- 使用者已授權開始新增「將位置釘選到日記項目」功能；current implementation baseline 仍是 `work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/`。
- Privacy boundary：位置必須由使用者主動開啟 picker、在地圖上選取並確認後才保存；第一版不自動讀取 browser geolocation、不使用 Places／Geocoding，也不把精確座標加入 `/api/chat`、`/api/summarize` 或任何 Gemini prompt。
- Planned schema：journal entry 新增 optional bounded `location` map，保存 latitude、longitude 與 optional short label；Firestore Rules 必須驗證 map keys、型別、座標範圍與 label 長度，並保持 owner-only path。
- Final key boundary：server runtime 只讀取 `GOOGLE_MAPS_API_KEY` 與 `GOOGLE_MAPS_MAP_ID`；signed-in picker 透過 authenticated、`no-store` 的 `/api/maps-config` 取得 browser-required values。不把新 key 寫入 source、Firebase config、logs 或 Gemini prompt。Browser key 必須是 Maps 專用 key，套用 Websites application restriction 與 Maps JavaScript API restriction。
- Planned UI：Maps library 僅在使用者開啟 picker 時按需載入；未配置 key／map ID 或載入失敗時顯示 bounded unavailable state，不影響日記、Gemini 或 Firestore 既有功能。
- Gemini safety instruction 將明確禁止模型聲稱能存取 Google Maps／API key、推測或揭露精確位置。Maps API interaction 保持 deterministic client UI；模型不負責 API invocation 或 secret retrieval。
- Status at kickoff：尚未修改 product source、尚未執行新測試、尚未建立或擷取 Google Maps key，亦未啟用付費 API、deploy 或 publish。

### 2026-09-04 — Google Maps pinned-location local implementation outcome

- 新增 `PinnedLocation` typed schema、`src/lib/location.ts`、lazy `src/lib/googleMaps.ts`、localized `src/components/LocationPicker.tsx`，並在 `JournalEditor.tsx` 加入 pin／edit／remove 與 Markdown export location metadata。
- 使用者必須明確開啟 picker 並 Save；第一版沒有 browser geolocation、Places、reverse geocoding。Map 尚未設定時 fail closed，核心 journaling 不受影響。
- `server.ts` 新增 location privacy system instruction；Gemini 不得聲稱能存取 Maps／keys／coordinates，且 chat／summary payload source review 確認都不含 `location`。
- `/api/maps-config` 位於 Firebase Auth 後、Gemini user limiter 前，使用獨立每 user 每小時 60 次 limiter，避免開啟地圖消耗既有每小時 20 次 Gemini quota。Unauthenticated smoke test：`401 AUTH_REQUIRED`、`Cache-Control: no-store`，body 無 `apiKey`／`mapId`。
- `firestore.rules` 僅允許 optional `location` map 的 `latitude`、`longitude`、optional non-empty label；座標限制為緯度 -90..90、經度 -180..180、label 最多 120 字元，也允許 `null` 表示移除。
- Automated evidence：location utilities 5／5；Firestore Emulator 24／24；TypeScript pass；Vite＋server production build pass；production audit 無已知漏洞。
- Source-only scan：0 private-key files、0 Bearer-token files；唯一 `AIza...` 仍是既有 Firebase Web config，Maps 只存在 `.env.example` placeholder，沒有取得或寫入 real Maps key。
- Review 找到並修正 blank coordinate 被 `Number('')` 轉為 `0` 的 edge case；新增 regression test，避免未選位置時誤存 `0,0`。
- Infrastructure notes：第一次 sandbox build 因 parent traversal access denied，放寬唯讀限制後 pass；第一次 local dev smoke 因既有 `tsx uv_os_get_passwd ENOMEM` 未啟動，改用 production bundle，signed-out landing page 正常載入。
- 尚待人工／外部設定：建立或選用 dedicated Maps JavaScript browser key、啟用 billing／Maps JavaScript API、建立 production JavaScript map ID、設定 Websites＋API restrictions、將兩值加入 runtime secrets，然後做 signed-in picker／save／reload／remove／export QA。
- 尚未 enable Maps API、建立或擷取 credential、發出付費 Maps call、deploy、publish 或寫入 production Firestore。

交接時應優先查看：

```text
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/server.ts
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/src/components/JournalEditor.tsx
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/src/components/Sidebar.tsx
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/src/lib/firebase.ts
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/src/types.ts
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/firebase-applet-config.json
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/firestore.rules
work/reflective-gemini-journal-post-responsive-remediation-2026-09-04/package.json
outputs/README.md
outputs/development-change-log.md
outputs/security-remediation-log.md
```

### 2026-09-04 — Google Maps production credential provisioning confirmed by user

- 使用者回報已在 Google Cloud Console 完成 dedicated production Maps JavaScript browser key 與 production JavaScript Map ID 的建立。
- 採用的識別名稱：API key `reflectai-journal-location-prod-web-key`；Map ID `reflectai-journal-location-prod-js-vector`。
- Intended restrictions：application restriction 使用 Websites，production referrer 僅 `https://reflective-journal-ai-companion.ai.studio/*`；API restriction 僅允許 Maps JavaScript API。Localhost／127.0.0.1 不加入 production key，若需本機互動測試則另建 dev key。
- Secret boundary：未在對話、source、logs 或文件記錄實際 key value；browser key 仍視為 client-visible credential，安全性依賴 website／API restrictions、quota monitoring 與 rotation readiness。
- Evidence boundary：上述為 user-reported Console configuration，尚未由本地端獨立驗證限制已儲存；尚未設定 `GOOGLE_MAPS_API_KEY`／`GOOGLE_MAPS_MAP_ID` runtime secrets、deploy、publish、發出 Maps request 或完成 signed-in picker QA。
- 下一步：先確認 Console 內 restrictions 顯示正確，再以 runtime secret／environment 注入兩值，完成 signed-in load／pin／save／reload／remove／export 與 denied-origin QA；不得把 real key commit 到 repository。

### 2026-09-04 — Google AI Studio Maps Secrets user-reported configured

- 使用者進一步回報 Maps 設定已加入 Google AI Studio Secrets；預期 names 為 `GOOGLE_MAPS_API_KEY` 與 `GOOGLE_MAPS_MAP_ID`。不記錄、顯示或要求任何 secret value。
- 這會取代上一段「runtime secrets 尚未設定」的 current status，但仍屬 user-reported external state；尚未透過 authenticated `/api/maps-config` 或 signed-in Preview picker 獨立確認 runtime injection。
- Local feature source 仍需同步／核對至 AI Studio checkpoint，才可驗證 Preview。Secrets 已設定不等同 source 已同步、Maps request 成功、Rules 已 deploy 或 feature 已 publish。
- 下一步維持 non-publishing QA：核對 AI Studio source，登入後測試 picker load、pin、save、reload、edit、remove、Markdown export、Gemini payload exclusion 與 console／network errors。沒有明確批准前不得 publish。

### 2026-09-04 — AI Studio location source synchronization checkpoint

- 已先下載 AI Studio 同步前 snapshot，並更名為 `C:\Users\User\Downloads\reflective-gemini-journal-ai-studio-pre-location-sync-2026-09-04.zip`；檔案大小 `272,381 bytes`。Windows 保留原下載時間 `03:15`，更名不會更新 LastWriteTime。
- Local verified candidate 與 AI Studio pre-sync snapshot 的 source diff 已完成；AI Studio 原版本保有 responsive remediation，但缺少 location feature。
- 已透過 AI Studio 附件映射同步精確 `12` 個檔案：更新 `.env.example`、`README.md`、`server.ts`、`firestore.rules`、`JournalEditor.tsx`、`src/types.ts`、typed i18n dictionary 與兩份 locale dictionary；新增 `LocationPicker.tsx`、`googleMaps.ts`、`location.ts`。
- AI Studio action history 回報 `Edited 12 files`／`Built`；TypeScript `tsc --noEmit` 與 production build 均為 `0 errors`。獨立 `View changes` 檢查亦只顯示這 `12` 個檔案與 `17` 個 unchanged files，增刪行數和本機 pre-sync diff 相符。
- AI Studio build 自動切換 Preview。因既有 signed-in session，Preview 自動讀取既有 owner-scoped Firestore journal list；沒有觸發 write、delete、Gemini generation、Rules deployment 或 publication。AI Studio summary 的「no live Firestore read」因此不能採信，應以實際 Preview evidence 為準。
- Preview environment prompt 顯示 `GOOGLE_MAPS_API_KEY` 與 `GOOGLE_MAPS_MAP_ID` names，但 values 未套用且 Apply disabled。這不否定使用者先前回報 Secrets 已建立，但證明本次 Preview runtime injection 尚未成功驗證；assistant 未查看、輸入或記錄任何 value。
- Post-sync ZIP download 由 UI 點擊及 browser download-event 監聽重試，仍未產生新檔；因此沒有 post-sync ZIP／SHA-256 可宣稱。下一步由使用者手動下載並以 `reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04.zip` 命名，再做 hash／byte comparison。
- Firestore Rules 仍只在 AI Studio source checkpoint 與本機 tests 中，尚未部署。Location picker load／pin／save／reload／edit／remove／Markdown export 仍待 runtime secrets 套用後的 signed-in Preview QA；未經明確批准不得 Publish。

### 2026-09-04 — AI Studio post-sync export independently verified

- 使用者已手動下載同步後封存檔，並將誤帶重複副檔名的 `reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04.zip.zip` 更名為 `C:\Users\User\Downloads\reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04.zip`。
- Archive evidence：`298,783 bytes`；SHA-256 `1B4CB3DBB1E945FB8DD66D0484C3426393C1AAE5DFC3B6494BF32806EF002A78`。解壓後的 29-file snapshot 已保存於 `work/reflective-gemini-journal-ai-studio-post-location-sync-2026-09-04/`。
- 本次同步的 12／12 個檔案與 local verified candidate 逐位元一致。全體 29 個 AI Studio export files 中，27 個與 local candidate 一致；僅 `.gitignore` 與 `package.json` 不同，差異完全是 local-only Emulator／location test tooling、scripts 與 dependencies。AI Studio export 沒有非預期檔案。
- Source-only scan 檢查 26 個文字來源檔：0 private-key block、0 Bearer token；`.env.example` 僅含 `MY_*` placeholder。唯一 `AIza...` 位於既有 `firebase-applet-config.json` Firebase Web client config，並非 Gemini 或 Maps runtime secret。
- Independent rerun：location tests 5／5；Firestore Emulator Rules tests 24／24；Vite frontend 與 esbuild server production build pass。Vite 僅回報既有 bundle 超過 500 kB 的 non-blocking optimization warning。
- Tooling incidents：自動更名先因 Downloads access denied，使用者已人工完成；`pnpm test:location` 先遭 sandbox temporary-file denial，提升權限後又因 non-TTY dependency purge guard 中止；未刪除或重建 `node_modules`，改用原 script 等價的 `node --test` 後 5／5 pass。`npm run build` 因 shell 無全域 npm 未啟動，改直接使用 project-local Vite／esbuild 後 pass。以上均非 product test failure。
- Post-sync export／source verification release gate 已完成。仍未確認 AI Studio Preview runtime secrets delivery，也未完成 signed-in map load／pin／save／reload／remove／export E2E；最新 transition-validation Firestore Rules 尚未 deploy，未經明確批准不得進行 production write 或 Publish。

### 2026-09-04 — Preview Maps runtime gate failed closed

- Signed-in AI Studio Preview 正常載入並讀取既有 owner-scoped 4-document journal list；點擊 `Pin Location` 後 picker 顯示 loading，隨後呈現 bounded unavailable message，核心 journaling 保持可用，`Save Location` 未啟用。
- AI Studio debug evidence：backend startup 顯示 `injected env (0) from .env`；兩筆 backend error 均為固定 `MAPS_UNAVAILABLE`／`Maps are not configured.`。因此可確認目前 Preview runtime 沒有收到 `GOOGLE_MAPS_API_KEY` 與 `GOOGLE_MAPS_MAP_ID`，尚未進入 Maps key website／API restriction 驗證階段。
- Baseline-only noise：既有 App Check reCAPTCHA Preview warning 與 Vite HMR websocket errors 仍存在，與本次 Maps configuration failure 分離記錄。
- 未查看、複製或輸入任何 secret value；未選座標、未啟用 Save、未寫入或刪除 Firestore data、未呼叫 Gemini、未 deploy Rules、未 Publish。下一步須由使用者在 AI Studio UI 將既有兩項 Secrets 實際套用至 Preview runtime，重新啟動／Reload app，再重試 map load。

### 2026-09-04 — AI Studio Secrets mapping defect identified

- Read-only `Settings → Secrets` inspection showed the single Maps row used credential display name `reflectai-journal-location-prod-web-key` as its environment-variable Name. The application instead reads the exact name `GOOGLE_MAPS_API_KEY`.
- No `GOOGLE_MAPS_MAP_ID` row was present. This exact two-part mapping defect explains `injected env (0)` and `MAPS_UNAVAILABLE`; source changes are not required.
- AI Studio accessibility unexpectedly returned the browser-key field value even though visibility was not intentionally toggled. The value is not reproduced in chat or documentation, was not copied, and the panel was closed immediately. Because a Maps JavaScript browser key is client-visible by design, this is not equivalent to exposing a server secret; nevertheless, rotate the key after correcting the mapping for clean credential hygiene and re-verify website／Maps JavaScript API restrictions.
- Human-only correction boundary：rename／recreate the first row as `GOOGLE_MAPS_API_KEY`, add `GOOGLE_MAPS_MAP_ID`, enter values manually, and click `Apply`. The assistant must not type, copy, or submit either value. Preview should use a separately restricted Preview/dev key because its `ais-dev-...run.app` origin is not the production published origin.

### 2026-09-04 — Production／Preview Maps key separation confirmed by user

- Production key remains restricted to Websites referrer `https://reflective-journal-ai-companion.ai.studio/*` and only the Maps JavaScript API.
- A separate Preview key has now been created and restricted to `https://ais-dev-wwpeecywfneevyhaf6dcuq-656992758307.asia-northeast1.run.app/*` and only the Maps JavaScript API.
- No new Map ID is required；the existing JavaScript Map ID can be supplied through `GOOGLE_MAPS_MAP_ID` for Preview and production. No credential value was shared in chat or written to source／documentation.
- Evidence boundary：restrictions are user-reported from Google Cloud Console and have not yet been independently proven by a successful Maps request. Next action is manual AI Studio Secrets mapping／Apply, followed by Preview reload and load-only verification before any Firestore write.

### 2026-09-04 — Preview Maps runtime load-only gate passed

- 使用者完成 AI Studio Secrets exact-name mapping、`Apply` 與 Preview Reload；assistant 未開啟 Secrets UI、未查看或擷取任何 value。
- Reload 後 signed-in Preview 與既有 4-document owner-scoped journal list 正常。點擊 `Pin Location` 後 Google Map 實際渲染成功，以台灣為初始視圖；不再出現 `MAPS_UNAVAILABLE`、referrer denial、Maps JavaScript API restriction 或 Map ID error。
- 未選座標時 latitude／longitude 維持空白，`Save Location` disabled。Picker 已由 close control 關閉；沒有選點、label、Firestore write/delete、Gemini request、Rules deployment 或 Publish。
- Post-reload console 只有既有 AI Studio Preview App Check reCAPTCHA warning；沒有新的 Maps warning/error，先前 Vite HMR websocket errors 本次亦未重現。
- Runtime delivery／allowed-origin／Map ID load gate 已通過。下一步仍需先取得明確批准並部署已通過 24／24 Emulator tests 的 transition-validation Firestore Rules，確認 active Rules 後，才可執行 pin／save／reload／remove production persistence E2E。

### 2026-09-04 — Location-aware Firestore Rules deployed

- 使用者已明確批准部署已驗證的 Firestore Rules。部署前重新執行 Emulator suite，結果為 `24 passed / 0 failed`；預期的 `PERMISSION_DENIED` 訊息來自 deny-path assertions，不是測試失敗。
- 第一次以 `npm run test:rules` 啟動失敗，因目前 shell 沒有 global `npm`；第二次透過 bundled `pnpm` 啟動時被 non-TTY dependency-purge guard 中止。兩次都未進入 test cases，且沒有刪除／重建 `node_modules`。改以 project-local runner 並只補入 bundled Node.js PATH 後完整通過。
- 發現 `firebase.json` 原本沒有明列 named database，若直接部署可能誤指向 `(default)`。已新增 `"database": "ai-studio-d82d6296-0049-4433-955f-91f203831d05"`，使 deployment target 與 app 的實際 journal store 一致。
- 第一次 deployment 使用隔離的 Firebase CLI config，因未登入而安全失敗，沒有發布變更。使用者完成 `firebase login --no-localhost` 的人工 OAuth 後，CLI 登入帳號為 `jimmy880625@gmail.com`。
- 最終限定 project `jimmy-gemini-journal` 且只執行 Firestore deployment。Firebase CLI 確認 rules compile、upload 與 `released rules firestore.rules to cloud.firestore` 成功，並回報 `Deploy complete!`。Rules SHA-256：`5BF26D72193716A62971ADB1AF7156F116E3C9368917D8A00484F37597715A94`。
- 未部署 Hosting／Functions、未 Publish AI Studio app，也未執行 location persistence write。下一步是等待規則傳播後，以 synthetic test point 完成 Preview pin／save／reload／remove／Markdown-export E2E，並清除測試位置。

### 2026-09-04 — Preview location persistence E2E passed by user

- 使用者回報在 Rules deployment 後完成 Preview `pin → save → reload → remove`，四個 persistence steps 均成功。
- 此證據確認目前 Preview 可在 active owner-scoped journal entry 寫入 location、重新載入後讀回，並持久移除；結果屬 user-operated UI evidence，assistant 本輪未獨立觀看座標或 Firestore document。
- 測試位置已移除。尚待完成 Markdown export 的雙向驗證：removed state 不得包含 location；synthetic pinned state 應包含 label／coordinates／Google Maps URL，完成後再次移除。

### 2026-09-04 — Removed-state Markdown export passed

- 使用者從已移除 location 的同一篇 Preview journal 成功下載 `.md`，並更名為建議的 QA filename。
- 人工內容檢查確認 location heading、先前 label 與 `google.com/maps/search/?api=1&query=` 均為 `0` 筆；移除後的敏感 location data 沒有殘留在 export。
- 此結果為 user-operated local-file inspection；檔案包含私人日記內容，未上傳或交由 assistant 讀取。Positive pinned-state export 尚待測試。

### 2026-09-04 — Positive Markdown export and final cleanup passed

- 使用者以公開地標 synthetic point 完成 pinned-state export；location heading、label 與 coordinates 均正確且各出現一次。
- Export 內的 Google Maps URL 可正確開啟對應位置；人工檢查未發現 Maps API key、Map ID、Firebase token 或其他 credential。
- 測試完成後已成功 `Remove → Reload`，location 維持移除狀態。私人 `.md` 未提供給 assistant，結果屬 user-operated file／UI evidence。
- Location feature 的 Preview release gate 現已完成：Map load、pin、save、reload、remove、removed-state export、positive export、Maps link、credential absence 與 final cleanup 均通過。尚未 Publish；publication 仍需另一次明確批准。

### 2026-09-04 — Production Maps credential transition applied

- 使用者重新確認 production browser key 的 restrictions：Websites 僅允許 `https://reflective-journal-ai-companion.ai.studio/*`，API 僅允許 Maps JavaScript API。
- AI Studio `GOOGLE_MAPS_API_KEY` 已由 Preview key 換成 production key；`GOOGLE_MAPS_MAP_ID` 保持既有正確 JavaScript Map ID，並已由使用者按下 `Apply`。
- 沒有 key／Map ID value 被貼入 chat、source 或文件。此為 user-confirmed external configuration；assistant 未讀取 secret value。
- Preview origin 此後可能因 production restriction 而無法載入 Maps，屬預期 fail-closed 行為，不應把 transient Preview origin 加入 production key。
- Pre-publish gates 現已齊備；app 仍未 Publish，需使用者另行明確批准。

### 2026-09-04 — App Check enforcement pre-publish status confirmed

- 使用者於 Firebase Console `Security → App Check → APIs` 確認 `Cloud Firestore` 目前顯示未強制執行。
- 這符合既定 monitoring-only plan；既有 Web app reCAPTCHA Enterprise registration／client initialization 保持不變，本次未按下 Enforce、未修改 provider、key、domain 或 threshold。
- Publish 後應先執行 production smoke test 並觀察 Verified／Unverified request metrics，再另行評估 enforcement。

### 2026-09-04 — Location-enabled AI Studio release published and archived

- 使用者明確同意並人工按下 `Publish your app`。AI Studio 隨後顯示 `Reflective — Gemini Journal Companion is published!`、status `Ready`、production URL `https://reflective-journal-ai-companion.ai.studio/`，且 action 變為 `Republish`；這是已發布狀態的 UI evidence。
- Release description 已更新，涵蓋 optional user-confirmed location pin、Google Maps deep link、location 不自動取得且不送往 Gemini、Firebase owner isolation、Markdown export，以及非診斷／治療／緊急服務界線。
- Assistant 未按下 `Republish`／`Unpublish`，亦未開啟或讀取 Secrets。Cloud Firestore App Check 維持 monitoring-only／unenforced，待 production smoke traffic 與 metrics review 後另行決定 enforcement。
- 第一次自動下載等待 browser download event 逾時，且 `Downloads` 未出現新 ZIP；沒有把 UI click 誤記為成功。依使用者要求移交人工操作後，使用者完成下載與更名。
- Post-publish source snapshot：`C:\Users\User\Downloads\reflective-gemini-journal-ai-studio-post-location-publish-2026-09-04.zip`；`298,783 bytes`；LastWriteTime `2026-09-04 16:04:02 +08:00`；SHA-256 `2153AD672833B9B8776AF723ABA9C7B747611A5CC6F22B92B23F2F02B9415798`。
- ZIP 可正常開啟，共 37 entries／29 files，unsafe path entries 為 0。雖然 archive-level SHA-256 與 pre-publish sync ZIP 不同，29／29 個 file-content SHA-256 全部一致，證明 Publish 未改變已驗證 source；差異僅為 ZIP packaging metadata。
- 下一步：在 production URL 執行 signed-in load、map load、synthetic pin／save／reload／remove 與 final cleanup smoke test；之後檢視 App Check Verified／Unverified metrics。未經另行批准不得啟用 enforcement 或再次發布。

### 2026-09-04 — Production smoke test Step 1 passed

- 使用者在 production URL 完成人工 load-only smoke test：登入成功、owner-scoped 日記列表正常載入、Google Map 正常顯示。
- 尚未選點時 `Save Location` 維持 disabled，確認 production UI 沒有把空座標轉成可儲存資料。
- 此結果同時提供 production browser key allowed-origin、Maps JavaScript API restriction、Map ID 與 runtime mapping 可正常運作的 user-operated evidence；未回報 `MAPS_UNAVAILABLE` 或 Maps load error。
- 本階段沒有選取／儲存座標、修改 Firestore 文件、呼叫 Gemini、變更 Secrets、App Check enforcement 或再次發布。下一步使用公開地標 synthetic point 執行 pin／save，再 reload 驗證 persistence。

### 2026-09-04 — Production smoke test Step 2 pin／save passed

- 使用者以 non-sensitive public-landmark synthetic point 完成人工測試；選點後 marker 與 coordinates 正確出現，`Save Location` 由 disabled 轉為 enabled。
- 儲存成功，journal UI 正常顯示測試 label、coordinates 與 Google Maps link，未回報 Firestore permission、Maps 或 validation error。
- 這是 production Firestore location write 與 presentation-path 的 user-operated evidence。測試 location 目前仍暫時存在，以供下一步 reload persistence 驗證；尚未完成 final cleanup。
- 本步未呼叫 Gemini、未修改 Secrets／Rules／App Check、未重新發布。下一步 reload，同篇 journal 應讀回相同 label、coordinates 與 link，確認後立即執行 remove／reload cleanup。

### 2026-09-04 — Production smoke test Step 3 reload persistence passed

- 使用者重新載入 production app 後，同篇 journal 的 synthetic location 仍存在；label 與 coordinates 和 reload 前保持一致。
- Google Maps link 仍可開啟正確的公開地標，且未出現 authentication、Firestore read、Maps 或 rendering error。
- 這是 deployed Rules 下 location persistence／read-back path 的 user-operated production evidence。Synthetic location 目前仍存在，release smoke gate 尚未完成，必須執行 remove／reload cleanup。
- 本步沒有新增 write、Gemini request、Secrets／Rules／App Check 變更或再次發布。下一步移除測試位置並 reload，確認 location card、label、coordinates 與 link 均不再出現。

### 2026-09-04 — Production location smoke gate completed with cleanup

- 使用者成功執行 `Remove Location`；location card、synthetic label、coordinates 與 Google Maps link 均立即消失。
- 再次 reload 並重新開啟同篇 journal 後仍維持 location-free，原日記內容正常，未出現 authentication、Firestore、Maps、rendering 或 validation error。
- Production location release gate 現已完整通過：sign-in、owner-scoped list read、Map load、empty-selection disabled state、public-landmark pin、save、display、reload persistence、Maps link、remove 與 final reload cleanup。
- 所有結果皆為 user-operated production UI evidence；assistant 未查看私人 journal content 或精確座標。QA location 已移除，沒有已知殘留測試資料。
- 本輪未呼叫 Gemini、未變更 source、Secrets、Rules 或 App Check、未再次發布。Location feature 可視為 production smoke verified；剩餘 operational follow-up 是觀察 App Check Verified／Unverified metrics，且 enforcement 仍需另行批准。

### 2026-09-04 — App Check 24-hour metrics block enforcement

- 使用者在 Firebase Console `Security → App Check → APIs → Cloud Firestore`、最近 24 小時區段回報共 81 requests：Verified `50／81`（62%）、Outdated client `0／81`、Unknown origin `0／81`、Invalid `31／81`（38%）。Cloud Firestore 狀態仍為 monitoring／unenforced。
- `38%` invalid 明顯不符合 enforcement gate；若立即 enforce，同類合法或來源未釐清的 requests 可能被拒絕。因此本次明確決定不按 `Enforce`，也不把 62% verified 誤記為已可強制執行。
- Firebase 官方將 Invalid 定義為帶有無效 App Check token 的 requests；可能來自非可信 client 或 emulated environment。由於此 24-hour window 同時涵蓋 AI Studio Preview／既有 Preview reCAPTCHA warning 與 production traffic，將 31 筆全部歸因於 production app 目前仍缺乏證據，此處僅記為待隔離調查。
- 下一步：關閉 Preview／local app，只用 production origin 產生少量 read-only legitimate traffic；等待 metrics 更新後查看較短 recent window，判斷 production requests 是否持續 Verified。未完成來源隔離與高 verified ratio 前不得 enforcement。

### 2026-09-04 — Production-only App Check increment remains invalid

- Baseline 24-hour metrics 為 Total 81／Verified 50／Invalid 31。依隔離步驟關閉 Preview／local clients，使用 production app 進行少量 read-only navigation 後，使用者回報 Total 84／Verified 51／Invalid 33；Outdated 與 Unknown origin 仍各為 0。
- Increment 為 3 requests：Verified +1、Invalid +2，約 33%／67%。樣本很小，且無法完全排除同時存在的外部 traffic，但它不支持「invalid 全部只來自舊 Preview」假設，並強烈顯示 production path 仍可能產生 invalid App Check tokens。
- Enforcement gate 維持 blocked／unenforced；若現在 enforce，production legitimate traffic 有中斷風險。停止進一步重複流量測試，先唯讀核對 App Check initialization order、registered web app／reCAPTCHA Enterprise configuration 與目前 public bundle，再決定是否需要 source remediation。

### 2026-09-04 — App Check source and production asset inspection

- 已唯讀檢查 published snapshot `src/lib/firebase.ts`：`initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(...), isTokenAutoRefreshEnabled: true })` 位於 `getAuth(app)` 與 named-database `getFirestore(...)` 之前，未發現 use-before-activation initialization-order defect。
- Production page asset inventory 確認目前載入 `assets/index-Bb7MtKAH.js`、`https://www.google.com/recaptcha/enterprise.js?render=explicit` 與 reCAPTCHA locale runtime；background page console 的 warning／error 為 0。這排除 App Check client code 完全未發布，但不證明每次 token exchange 都有效。
- 嘗試透過 `Invoke-WebRequest` no-cache 下載公開 bundle 供文字比對時，執行環境 TLS／authentication layer 回報失敗；沒有取得或寫入 bundle，也不是 production app login failure。改以 browser page-asset inventory 完成目前可行的非侵入式驗證。
- 目前沒有足夠 evidence 支持 source remediation。下一優先是人工核對 Firebase App Check web-app registration 是否使用 snapshot 中相同 reCAPTCHA Enterprise key，以及 Google Cloud key 是否為 score-based Web key、domain list 使用裸 hostname `reflective-journal-ai-companion.ai.studio`（不得含 scheme／path／port），且未啟用 allow-all-domains。任何設定變更前須另行確認。

### 2026-09-04 — Firebase App Check web registration verified

- 使用者在 Firebase Project settings 核對唯一的 Web app：Firebase App ID 最後八碼為 `675f3232`，與 published snapshot 的 app ID 一致；`Your apps` 內共有 1 個 Web app。
- 返回 `Security → App Check → Apps` 後，該 app 顯示 Registered，provider 為 `reCAPTCHA Enterprise`。
- 這排除錯誤 Firebase Web app registration、重複 Web app 選錯與 provider 未註冊等原因；本步沒有開啟 enforcement 或修改 registration。
- 尚未確認 registration 所綁 site key 與 bundle 中 key 是否一致，也未核對 Google Cloud key type／allowed domain。下一步在 project `jimmy-gemini-journal` 進行 read-only reCAPTCHA Enterprise key inspection。

### 2026-09-04 — reCAPTCHA Enterprise key configuration verified

- Google Cloud project `jimmy-gemini-journal` 只有一組相關 key：`reflective-journal-app-check`。其 40-character key ID suffix 與 published `firebase-applet-config.json` 的 `recaptchaSiteKey` suffix `RcNu5e` 一致，確認 Firebase／bundle／Google Cloud key mapping 正確；完整 key 未記錄於本文件。
- Key type 為 Website／Score，非 Checkbox integration。Allowed domain 只有裸 hostname `reflective-journal-ai-companion.ai.studio`，沒有 scheme、wildcard、path、port 或 localhost。
- `停用網域驗證` 為關閉，故 domain verification 啟用；AMP allowance 亦關閉。Overview 顯示 key protected／integrated 並已有 assessment activity。
- 因 source、registration、key mapping、key type 與 domain settings 全部正確，目前不得推定需要 code 或 key remediation。下一隔離變數是 browser environment：先前 production sample 來自 Codex in-app browser，reCAPTCHA 可能合理將 embedded／automated traffic 評為高風險。下一步改用一般 Chrome 產生少量 read-only traffic，再比較 Firebase App Check metrics delta。

### 2026-09-04 — Ordinary Chrome App Check isolation passed

- 一般桌面版 Chrome read-only production sample 前，Cloud Firestore 24-hour metrics 為 Total 102、Verified 67（66%）、Invalid 35（34%）、Outdated 0、Unknown origin 0。
- 相同 sample 後為 Total 104、Verified 69（66%）、Invalid 35（34%）、Outdated 0、Unknown origin 0；increment 為 2 requests，2／2 Verified、0 Invalid。
- 這是強而直接的 user-operated evidence：正常 Chrome production path 能取得有效 App Check token；先前 Codex in-app browser 隔離樣本的 invalid 很可能來自 embedded／automation client risk classification，而非 source、Firebase registration 或 reCAPTCHA key／domain defect。由於不能逐筆標記 origin，結論仍以「高度可能」而非絕對歸因表述。
- 不需要 code、key 或 domain remediation；應避免再使用 Codex in-app browser 作 App Check production readiness evidence。整體 24-hour percentage 仍受既有 35 invalid requests 影響，Cloud Firestore 維持 unenforced。待這批歷史 traffic 滾出 recent window，再以一般 browser legitimate traffic 重新評估；enforcement 仍需另行明確批准。

### 2026-09-04 — RBAC／外部通知／全球安全資源 local candidate

- 已在新的 isolated candidate `work/reflective-gemini-journal-rbac-notifications-2026-09-04/` 完成第一版實作，未覆寫 published snapshot，亦未 deploy／Publish。
- RBAC 採 Firebase Custom Claims：`user`、`admin`、`owner`。Frontend 只控制 UI；backend 每次以已驗證 ID Token 的 signed claim 執行 authorization。
- `owner` 同時要求 `OWNER_UIDS` allowlist，且只有 owner 能把 `user` 與 `admin` 互相切換。禁止 self-change、一般流程修改 owner、舊登入、未驗證 email、缺少 exact confirmation、缺少 audit reason、重播 idempotency key。
- 已新增 server-only `role:bootstrap-owner` 與 `role:manage` 指令，但未執行。沒有 Firebase user role 被修改。
- AI role-review instruction 僅能提出風險與缺少 evidence；不得批准、執行、繞過 deterministic checks，亦不得接觸 credential、token、recovery code、private journal 或 notification secret。目前不呼叫 Gemini 決定角色。
- Admin Dashboard 僅顯示 uptime、目前 role、service 是否 configured 與 privacy posture，不提供私人日記存取。
- 外部通知支援 Gmail API、Slack、Discord adapter。所有通知預設關閉並須 explicit opt-in；外部 payload 只有 generic event label 與登入 URL，不含日記、摘要、位置、crisis 原文、UID、email、token、key 或 webhook。
- 採用 opt-in／minimal-data 的原因：外部平台收到訊息後會形成 Reflective 控制範圍外的新副本，其 retention、channel membership、forwarding 與 account access 皆由第三方管理。預設關閉保留 user agency，最小 payload 可降低錯誤設定、帳戶入侵或 webhook 洩漏時的 privacy impact。
- Gmail 採 OAuth 2.0 offline access 與 `gmail.send`；不支援 Gmail 密碼或 App Password。OAuth client secret／refresh token、Slack／Discord webhook 只允許 server-side Secret Manager／environment。
- Slack／Discord V1 為 app-owned webhook adapter；若要每位使用者連接自己的 workspace／server，仍需另做 per-user OAuth 與 encrypted token vault，不能把 webhook 存入 client Firestore。
- Crisis notification 不在外部 event allowlist。Email／Slack／Discord 不是 emergency service，不會由自殺字眼自動通知第三方。
- 新增 user-selected safety region：`IN` 顯示印度官方 `112` 與 Tele-MANAS `14416／1800-89-14416`；`TW` 顯示既有台灣資源；`EU` 顯示 `112`；其他／未知地區導向 Find A Helpline global directory。
- Region 不使用 GPS、IP geolocation、pinned journal location 或 Gemini inference；只存 region code 並在 server crisis pre-check deterministic 使用，不進入 Gemini prompt。
- 自動撥打緊急聯絡人方案目前拒絕。未來若新增，只能是使用者明確點擊、裝置 dialer 再確認的 trusted-contact action；不得由 AI／keyword detection 自動撥打或背景通知。
- Local verification：TypeScript pass；RBAC／notification／crisis `13／13`；location `5／5`；Firestore Emulator `30／30`；frontend／server production build pass；production audit 無 known vulnerabilities。
- 驗證過程發現並修復 `firebase-admin` dependency chain 的 moderate `uuid < 11.1.1` advisory，最終 pnpm resolution 為 patched `uuid 11.1.1`。兩次 sandbox build 因 dependency ancestor access denied 失敗，approved unsandboxed build 通過；此為環境問題而非 source failure。
- 尚未完成：Admin SDK IAM、owner bootstrap、Google OAuth consent、Gmail／Slack／Discord secret provisioning、live delivery、signed-in Admin／notification／safety UI QA、negative-path API E2E、Rules deploy、AI Studio sync／Publish。App Check enforcement 沒有變更，仍為 unenforced。
- Source-only ZIP：`outputs/reflective-gemini-journal-rbac-notifications-global-safety-2026-09-04.zip`；229,088 bytes；49 entries；0 unsafe paths；SHA-256 `F0C525FD7127E6FEA8DACEC1C47F3C1D32072D14E7817513086A984C0C56A4E4`。

### 2026-09-04 hybrid-source clarification

- Google AI Studio remains the primary Build app／publication surface; subsequent reviewed changes also exist locally.
- A fresh read-only AI Studio export was compared to the RBAC／notification／regional-safety candidate with a source-only SHA-256 manifest.
- `src/components/Sidebar.tsx` matches exactly across both sources, preserving the later AI Studio Mobile-landscape fix.
- The intended merge is AI Studio current plus the local reviewed delta. No AI Studio edit, Secret, role, Rule, sharing, deployment, or publication change has occurred in this synchronization phase yet.
- A minimal 17-file attachment payload plus one strict instruction document is ready locally and passed the corrected credential-pattern scan. It has not been uploaded or submitted.

### 2026-09-05 synchronization blocker

- User authorized AI Studio upload／unpublished editing, but the browser automation boundary rejected both multi-file and single-file uploads; zero attachments and zero edits resulted.
- Direct assistant requests failed before editing under Gemini 3.8 Flash and Gemini 3.6 Flash with console evidence `RpcError: The caller does not have permission`.
- AI Studio free requests are active, while API-key selection opens paid upgrade choices. No paid choice, API key, credential, source, Secret, role, Rule, sharing, deployment, or publication change occurred.
- Resume by manually uploading `outputs/ai-studio-sync-payload-2026-09-04/`, or only after a separate decision on paid AI Studio access.
- 2026-09-05：AI Studio editing-chat model has been restored and visually verified as `Default (Gemini 3.8 Flash)`. No prompt, runtime model, API key, billing, source, Secret, role, Rule, sharing, deployment, or publication changed.
- 2026-09-05：Do not enter the requested `.env.example` placeholders. `BOOTSTRAP_*` and `ROLE_*` are one-time CLI inputs; `FIRESTORE_DATABASE_ID` already has the correct non-secret default; `OWNER_UIDS` and Gmail／Slack／Discord configuration remain unset so privileged mutation fails closed and delivery stays disabled.

### 2026-09-05 — AI Studio synchronization integrity gate completed

- 使用者已人工上傳並送出 17-file payload。AI Studio 以 Default Gemini 3.8 Flash 執行，回報 `tsc --noEmit` 與 production build 均為 0 errors；所有 optional environment variables 維持 unset，沒有 owner bootstrap、role change、notification、live Firestore、Rules deploy、sharing、deployment 或 publication。
- Post-sync ZIP 為 `reflective-gemini-journal-ai-studio-rbac-notifications-safety-build-verified-2026-09-05.zip`；349,873 bytes；46 entries；0 unsafe paths；SHA-256 `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`。
- 獨立 exact comparison 通過：17／17 target files 與上傳 payload byte-identical；approved target 以外的 baseline files 為 0 differences；`src/components/Sidebar.tsx`、`bun.lock`、Firebase app identity 與 metadata 均未改變。
- 獨立 secret scan 掃描 37 files，只命中預期公開的 Firebase Web API key；沒有 private key、OAuth token、Gmail client secret、Slack／Discord webhook。TypeScript 0 errors；sandbox 外 production frontend/server build 通過，僅有 Vite large-chunk performance warning。
- 驗證環境事件：首次 dependency install 因 antivirus quarantine 中斷；第二次被 pnpm build-script policy 阻擋；optional `re2` native fallback 受 missing npm／AppData permission 影響；第一次 build 被 sandbox upward-directory access 拒絕。這些事件未造成 source mismatch，且相同 build 在 sandbox 外成功。
- Dependency audit 尚未完成。ZIP 使用 `bun.lock`，local verifier 只有 pnpm；暫時 pnpm resolution 報告一項 moderate `uuid 9.0.1` advisory，不可視為 Bun runtime resolution 的最終結論。依使用者指示，下一次 retry 必須改為人工引領，不再自動調整 dependency 環境。
- 現況：AI Studio source sync 與 build gate 已完成；archive-level dependency audit、signed-in Admin／notification／safety negative-path E2E、owner／credential provisioning、live delivery、Rules deploy 與 Publish 仍是分開的 pending gates。

- 2026-09-05 人工 prerequisite check：使用者在 PowerShell 執行 `bun --version`，系統回報無法辨識 `bun`。因此尚未執行 Bun dependency install／audit，也未修改任何 project／cloud state。下一步由使用者透過 Bun 官方 Windows installer 安裝，開啟新 terminal 驗證版本後再繼續。

### 2026-09-05 — Free Trial budget guardrail completed

- 使用者已在 target Free Trial Billing Account 建立 alerts-only budget `jimmy-gemini-journal-free-trial-monitor-2026`。
- Custom period 為 2026-09-05 至 2026-10-14；specified target 為 TWD 3,000；actual-spend thresholds 為 TWD 300／1,000／3,000，UI 顯示 10%／33%／100%。
- Budget calculation 排除 promotional credit，以便看見 credit 抵扣前的消耗；USD 300 credit 本身仍保持可用並會自動抵扣 eligible charges。Free Tier 等另外七類 savings 仍納入計算。
- 初始追蹤為 TWD 0／3,000。沒有 enforced spend cap、Monitoring／Pub/Sub automation、billing disablement、code／Secret／deployment／publication change。
- `jimmy-gemini-journal` 尚未在本 checkpoint 轉移 Billing Account。下一步必須使用 direct `Change billing`，不得先按 `Disable billing`。

### 2026-09-05 — Billing Account direct change reported successful

- 使用者在 Google Cloud Console 對 exact Project ID `jimmy-gemini-journal` 執行 direct `Change billing`。
- Pre-change source 為 `Jimmy`，target 明確顯示 `My Billing Account`；畫面沒有 permission、service interruption 或 billing-disabled warning。
- 使用者按下 `Set account` 後，Console 顯示專案已移至其他 Billing Account 的成功訊息。過程未先 disable billing。
- 沒有 code、Secret、Rule、data、AI Studio source、deployment、sharing 或 publication change。
- 現階段為 user-operated success evidence；仍需 read-back 確認 project row 顯示 `My Billing Account`，並確認 Firebase pricing plan 保持 Blaze，才能進入 production smoke checks。

- Billing read-back 已通過：`My projects` 顯示 project name／exact Project ID 均為 `jimmy-gemini-journal`，Billing Account 為 `My Billing Account`／`我的帳單帳戶`，沒有 disabled、pending、error、lock 或 warning。Billing reassociation gate 完成；下一步唯讀確認 Firebase 仍為 Blaze。

### 2026-09-05 — Firebase Blaze continuity passed

- 使用者在 Firebase Console 確認 `jimmy-gemini-journal` 仍為 `Blaze／Pay as you go`。
- 沒有 billing error、Billing Account relink request 或 service-restriction warning。
- 本步為 read-only verification，沒有 pricing、Firebase setting、data、Rule、credential、deployment 或 publication mutation。
- 下一 gate：使用一般桌面版 Chrome 執行 minimal production smoke，確認 published app、authenticated Firestore read、Cloud Run Maps-config path 與 Maps rendering；不得建立或變更 journal/location data。

### 2026-09-05 — Post-billing production smoke Step 1 passed

- 使用者在一般桌面版 Chrome 完成 published app／Firestore read-only smoke：page render、authentication、journal list load、existing journal open 全部通過。
- 未出現 Firestore permission、billing、authentication、App Check 或 network error。
- 沒有 create／edit／delete journal 或 location，也沒有 Gemini chat／summary request。
- 下一步只開啟 location picker，確認 authenticated Cloud Run Maps-config delivery 與 Maps rendering；不得選點或儲存。

### 2026-09-05 — Post-billing production smoke gate completed

- 使用者以一般 Chrome 開啟 location-free journal 的 picker；authenticated Cloud Run Maps-config delivery 與 Google Maps tiles／controls 正常。
- 未出現 `MAPS_UNAVAILABLE`、configuration、API-key、referrer、billing、authentication、Firestore、App Check 或 network error。
- 未選點時 `Save Location` 維持 disabled。使用者未選點、未儲存並關閉 picker；重新開啟 journal 後確認沒有 location card／coordinates。
- Combined smoke 已涵蓋 published app、Auth、Firestore read、Cloud Run config delivery 與 Maps rendering；沒有 data mutation 或 Gemini request。
- Billing Reports promotional-credit attribution 仍需等待 24–48 小時 reporting latency 後人工核對。

### 2026-09-05 — Reminder automation blocked; manual path selected

- 嘗試建立 Billing Reports 24–48 小時檢查與 10 月初 Free Trial expiry decision 的一次性 Codex reminders。
- Scheduler 因 timezone-anchored local time 轉 UTC 語意而拒絕兩次建立；目前 zero automation，沒有 partial／duplicate reminder。
- 依使用者指示，失敗後停止自動 retry，也沒有 Billing／cloud／source mutation。
- 下一步由使用者在明確採 Asia／Taipei 時區的 Google Calendar 人工建立兩個 reminders。

### 2026-09-05 — Challenge deadline and required artifacts

- User-provided official deadline：`2026-09-07 02:29 IST`＝`2026-09-07 04:59 Asia/Taipei`。Internal working deadline 提前至 `2026-09-06 18:00 Asia/Taipei`，保留約 11 小時 contingency。
- Required submission artifacts：public Cloud Run prototype URL 或 public walkthrough；LinkedIn／X／Facebook／Medium demo post 且必須含 `#AccelerateAIwithCloudRun`；public GitHub／GitLab repo（frontend＋backend＋deployment README＋Firestore Rules）；brief description；track／service confirmations。
- Automated eligibility 另要求 Cloud Run service label：`dev-tutorial=cloud-run-ai-challenge`。
- 兩張 screenshots 與 Codelab URL 是 requirement references，不是上述 artifacts 的替代品。
- Prototype final QA、Gemini production smoke、Cloud Run label verification、public repo security／license gate、demo video／social post、brief description、public-link incognito test 與 form submission 均尚待完成。Billing Reports review 不得阻塞 submission。

### 2026-09-05 — Submission milestones and conditional candidate release

- 使用者已人工建立四個 Asia／Taipei Calendar milestones：eligibility audit、repo freeze、demo assets complete、internal submission deadline。
- 使用者希望 deadline 前把已同步的 RBAC、external notifications 與 regional safety resources 納入 production，以增強 originality、usability、stability、security judging evidence。
- Release gate：candidate 必須先通過 Preview，再通過 production smoke 才能作為 deployed submission evidence；目前已驗證的 location-enabled release 保留為 deadline-safe fallback。
- Owner bootstrap、notification credentials／live delivery 仍是 separate gates；未 configured 功能只能描述為 fail-closed／disabled，不得宣稱 live。
- 下一步唯讀確認 Cloud Run label `dev-tutorial=cloud-run-ai-challenge`，尚未做 label mutation 或 candidate Publish。

### 2026-09-05 — Cloud Run eligibility checkpoint passed

- 使用者確認 healthy deployed service 為 `reflective-gemini-journal-companion`，region `us-west1`。
- Required service label 已存在且 exact：`dev-tutorial=cloud-run-ai-challenge`。
- Cloud Run endpoint configuration 列出 custom domain `reflective-journal-ai-companion.ai.studio`，確認 published app hostname 對應此 service。
- 兩個 default HTTPS endpoints 均 enabled，但回報中的 `run.app` URLs 被 UI 截短。完整 hostnames 是下一個 read-only follow-up。
- 沒有 label／revision／traffic／deployment／publication mutation。前兩次 multi-file patch 因 context mismatch 原子失敗，沒有 partial edit；corrected per-file retry 已完成。

### 2026-09-05 — Cloud Run endpoint read-back complete

- Default endpoint 1：`reflective-gemini-journal-companion-516107960247.us-west1.run.app`。
- Default endpoint 2：`reflective-gemini-journal-companion-ktotj325za-uw.a.run.app`。
- 兩個 default endpoints 與 `reflective-journal-ai-companion.ai.studio` custom domain 均對應同一個 healthy Cloud Run service。
- Submission 暫定採 endpoint 1 作 canonical Cloud Run URL，待 signed-out／incognito public-access smoke 通過。
- 本步沒有 credential、query parameter 或任何 cloud／code mutation。首次 combined documentation patch 因 CONTEXT mismatch 原子失敗；corrected per-file update 已完成。

### 2026-09-05 — Canonical Cloud Run URL public gate passed

- 使用者在 fresh signed-out／incognito window 開啟 `reflective-gemini-journal-companion-516107960247.us-west1.run.app`。
- Landing page 正常顯示，最後停留 hostname 不變。
- 沒有 `403`、`404`、`5xx`、certificate warning、blank page 或 redirect loop。
- Endpoint 1 現可作為 challenge form 的 canonical Cloud Run URL candidate。
- 沒有 sign-in、journal／Firestore mutation、Gemini request、deploy、traffic 或 publication change。

### 2026-09-05 — Custom-domain public gate passed

- 使用者在相同 signed-out／incognito context 開啟 `reflective-journal-ai-companion.ai.studio`。
- Landing page 正常顯示，final hostname 維持 custom domain。
- 沒有 `403`、`404`、`5xx`、certificate warning、blank page 或 redirect loop。
- Direct `run.app` canonical URL 與 human-facing custom domain 的 public-access eligibility 均已確認。
- 下一 gate 是 AI Studio candidate 的 signed-in Preview QA；本步沒有 sign-in、data／Gemini mutation、deploy 或 publish。

### 2026-09-05 — Candidate Preview responsive blocker

- Normal-user signed-in Preview：login state valid；Notifications 與 Safety resources visible；Administration hidden；RBAC visibility pass。
- User device QA：Tablet portrait／landscape pass；Mobile landscape pass；current screen size 的 controls 遮住 Markdown export；Mobile portrait 遮住 Title editor。
- Codex 以 computer-use skill read-only 直接觀察 current-screen-size，量到 Notification 與 Export 約 41 px 真實 overlap。
- Root cause：`src/App.tsx:243` 的 `fixed right-4 top-4 z-40` control group 脫離 `JournalEditor.tsx` header flow，沒有替 title／actions 保留空間。
- Candidate Publish 暫停，先修正 responsive placement 並重測受影響 viewports。本次沒有 UI action、setting save、notification send、code edit、deploy 或 publish。

#### Mobile portrait direct evidence

- 使用者切換至 Mobile portrait 後，Codex 以 computer-use skill 唯讀觀察 `375 × 667` app viewport。
- Title bounds：`x 60.0–359.4, y 12.0–40.0`；Notification：`x 269.1–310.3, y 16.0–57.1`；Safety：`x 318.3–359.4, y 16.0–57.1`。
- 兩個 controls 各與 Title 交疊約 41 px，合計侵入右側約 90 px；Mobile portrait defect confirmed。
- 此觀察沒有 click、device-mode change、field edit、Firestore／notification operation、deploy 或 publish。

### 2026-09-05 — Local responsive remediation pending manual build

- User confirmed implementation。Functional source changed only：`src/components/JournalEditor.tsx`。
- Added `pr-24 xl:pr-0` to title row and `xl:pr-24` to action controls，reserving 96 px at the collision locations without changing feature logic。
- First wrapper had a JavaScript parse error before patch execution；separated `apply_patch` succeeded。
- TypeScript／`pnpm run lint`：pass，0 errors。
- Production build：not verified。Sandbox blocked upward-directory access and Vite could not load `vite.config.ts` before compilation。
- Manual fallback active：user must run build outside sandbox；no automated retry／escalation，no AI Studio upload，no deploy／publish。

#### RBAC icon clarification

- 左上 `隔離路徑運作中` 旁是 Sidebar 的 `Shield` isolation-status icon，不是 Administration。
- Administration 是 `App.tsx` 中獨立的 top-right `ShieldCheck` button，只對 `admin／owner` render。
- Current normal user 看不到 Administration 是 expected RBAC pass；沒有 role／token／UI mutation。

### 2026-09-05 — Downloads archive move pending destination

- Read-only top-level inventory found 9 matching Reflective／Gemini Journal ZIPs in Downloads；no matching extracted folder。
- Latest Downloads ZIP matches existing `outputs` copy exactly：SHA-256 `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`。
- No move／overwrite／delete／extract／rename yet；exact destination pending user confirmation。
- Moving Downloads archives will not change the current extracted build path under `work`。
- First combined documentation patch failed atomically on stale context；corrected per-file update completed。

#### Proposed D-drive archive location

- Proposed base：`D:\Lessons\Computing\_Lessons\Google\Hack2skill (H2S)\Gen AI Academy APAC\Ideathon Challenge`。
- Read-only verification：only `D:\Lessons` currently exists；remaining directories need manual creation。D drive free space approximately 2,379.76 GB。
- Recommended destination leaf：`archives\ai-studio-exports\2026-09-05`。
- Suitable for 9 ZIP archives；spaces／parentheses require quoted CLI paths only。
- No directory creation or move performed。Current C-drive work／build path remains unchanged。

### 2026-09-05 — Manual archive relocation verified

- Actual path uses one folder `Computing_Lessons`；the earlier literal `Computing\_Lessons` check incorrectly represented two segments and returned absent。
- Verified dated archive destination contains exactly 9 matching ZIPs；Downloads matching count is 0。
- Latest moved ZIP SHA-256 remains `46E11C646A2D5C3273B1A7FE4250E20786B632EE08A28888EEBBB01B04F8E280`。
- Two pre-existing files under `myproject zip files` are outside this move and untouched。
- Codex performed read-only verification only；C-drive active work path remains ready for manual build。

### 2026-09-05 — Manual build blocked before execution

- User ran `pnpm run build` from the correct project folder；PowerShell reported `pnpm` not recognized。
- Build script／Vite／esbuild did not start；no dependency, lockfile, artifact, code, cloud, deploy, or publish change。
- Treat as user-shell PATH／tool availability blocker，not source failure。
- Manual fallback：do not install pnpm automatically。Next check only `node --version` and `npm --version`；use existing npm if available。

#### Bundled toolchain fallback

- User-shell `node --version` failed：Node not in PATH。npm check skipped；build did not start。
- Found existing Codex Node `24.19.0` at `C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。
- Found self-contained wrapper `C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`；it invokes adjacent bundled Node／pnpm and requires no install or PATH mutation。
- Next manual gate：absolute wrapper `--version` only。

#### Bundled pnpm available

- User-shell absolute wrapper returned `pnpm 11.19.0`。
- No install／PATH／dependency／lockfile／source mutation。
- First documentation patch wrapper parse failed before execution，with no partial edit。
- Next：manual production build from exact candidate directory using the same wrapper。

#### Child build command cannot resolve Node

- Absolute pnpm wrapper started and selected the expected build script。
- Vite child shim failed before compilation：`'node' is not recognized`；`ELIFECYCLE` exit 1。
- Cause：child `.cmd` uses current PowerShell PATH，although outer pnpm wrapper uses bundled Node directly。
- No dependency／lockfile／source／successful artifact／cloud mutation。
- Next manual gate：process-local PATH prepend for bundled Node，verify version；never persist User／Machine PATH。

#### Process-local Node available

- Current PowerShell now resolves `node v24.19.0` after temporary PATH prepend。
- Setting is process-only；no persistent PATH／install／dependency／lockfile／source mutation。
- Ready to rerun production build with absolute pnpm wrapper in the same shell。

#### Responsive production build passed

- Manual retry completed successfully with Node `v24.19.0` and pnpm `11.19.0`。
- Vite `6.4.3` transformed `2271` modules and built the client in `4.28s`；esbuild emitted `dist/server.cjs`（34.2 kB）and `dist/server.cjs.map`（58.0 kB）。
- Generated Tailwind CSS was inspected literally and contains `pr-24`, `xl:pr-0`, and `xl:pr-24`；responsive reservation rules are present in the artifact。
- Vite's `> 500 kB` chunk notice applies to the `1,246.10 kB` minified JS bundle and is a non-blocking optimization item。
- No deploy／Publish／AI Studio sync occurred。Next release gate is exact `JournalEditor.tsx` synchronization followed by current-screen，Mobile portrait／landscape，Tablet portrait／landscape，title-editing，and Markdown-export QA。

#### AI Studio synchronization remains pending

- First upload prompt contained no actual attachment or pasted source，so Gemini correctly stopped with 0 changed files。
- Reported AI Studio typecheck／build success covers the unchanged baseline only。
- No secrets，role operation，notification，Firestore access，deploy，or Publish occurred。
- Retry manually after confirming the `JournalEditor.tsx` attachment chip／filename is visible in the prompt；then verify the changed-file list contains exactly that path。

#### AI Studio attachment received；typecheck blocker isolated

- Second synchronization changed only `src/components/JournalEditor.tsx` and included the intended responsive classes。
- AI Studio line 489 differs from the attachment：undefined `errorDataCode(errData)` caused `TS2304` and typecheck exit 2。
- Local line 489 is `const code = typeof errData?.code === 'string' ? errData.code : '';`；fresh local typecheck passes with zero errors。
- AI Studio's successful Vite／esbuild output does not override the failed semantic typecheck。
- No unauthorized repair／secret／role／notification／Firestore／deploy／Publish action occurred。Release state remains blocked pending exact one-line restoration and dual verification。
- Nonessential Bun path probe failed before execution and made no changes。

#### Manual AI Studio repair applied，not yet verified

- User manually restored line 489 to the local `errData.code` expression and saved the file。
- AI Studio search was unavailable；remaining `errorDataCode` count and both responsive class strings are unknown。
- Require a strict no-edit source inspection，`tsc --noEmit`，and production build before responsive QA or Publish。

#### AI Studio responsive revision statically verified

- User's manual line 489 repair was confirmed read-only：`errorDataCode` count 0 and valid `errData.code` expression present。
- Responsive class strings remain at lines 606／638。
- AI Studio typecheck exit 0；production build exit 0；errors 0；warnings 0；verification changes 0 files。
- No privileged，data，secret，deployment，or publication operation occurred。
- First combined documentation patch failed atomically due stale candidate-README context and made no partial edit。
- Release state：source sync／typecheck／build pass；signed-in Preview responsive and interaction regression remains pending before Publish。

#### No privileged account configured；role scripts missing

- Google／AI Studio account ownership is unrelated to app RBAC。Client role derives only from Firebase ID token Custom Claim `role`。
- Current signed-in account resolves to `user`，so no Administration `ShieldCheck` is expected。
- `OWNER_UIDS`／owner bootstrap settings remain unset and no bootstrap operation was run；no admin／owner account is currently evidenced。
- `package.json` references `scripts/bootstrap-owner.ts` and `scripts/manage-role.ts`，but both files and their parent directory are missing from candidate and outputs。
- Read-only missing-path errors caused no mutation。An initial documentation patch also failed before application due to an invalid placeholder，with no partial edit。
- Admin-role setup／E2E is blocked pending restoration，security review，tests，and explicit authorization。Normal-user responsive Preview QA remains available。


### 2026-09-05 — Direct Mobile portrait Preview observation

- Direct Chrome screenshot shows the signed-in Mobile portrait editor: Title is truncated within its reserved space and no longer visually overlaps Notifications or Safety; the Markdown export button is visible on the separate action row. No page-wide horizontal overflow is visually apparent; the composer mode strip has its own horizontal scrolling.
- This is a visual observation only. Title editing, export execution, other viewport modes, and admin/owner three-button layout remain untested. No journal input, data write, notification dispatch, role change, or Publish was performed.
- Opened the existing debug panel read-only. It contains Vite WebSocket connection failure and an unhandled rejection, plus four Firebase Auth App Check reCAPTCHA warnings. Their current reproducibility and impact remain undetermined; login and the journal UI are visibly available.
- Direct build log contradicts Gemini's reported zero warnings: it shows the >500 kB chunk advisory (JS 1,246.70 kB, gzip 343.12 kB), while build succeeded. Treat prior zero-warning statements as superseded by this direct evidence.
- Closed the debug panel without dismissing logs; preserved Mobile portrait state. Next: manually verify Title focus without changing text, then other responsive modes; investigate Preview warnings before declaring runtime QA complete.

#### New-conversation checkpoint

- Mobile portrait Title focus：passed，no text mutation。
- Mobile portrait Title／Notifications／Safety collision：resolved by direct observation。
- Still pending：post-fix Markdown export click，Mobile landscape，Tablet portrait／landscape，Preview WebSocket／App Check warning assessment。
- RBAC privileged path remains blocked：no owner／admin configured and referenced role scripts are absent。
- Model preference update：special GPT-6 Astra low／GPT-5.6 medium switching is cancelled and must not continue。
- First handoff-document patch failed atomically on Markdown context parsing；no partial edit。

### 2026-09-05 — Responsive Preview regression completed

- Mobile portrait Markdown export：passed。`export-entry-btn` was visible and clickable；the downloaded `qa___normal_summary_test.md` contained the correct title、summary、all 4 takeaways、and both journal messages。
- Mobile landscape：passed visual separation；Title、Notifications、Safety、summary、export、and delete controls remained individually accessible，and Title focus succeeded without changing data。
- Tablet portrait／landscape：passed visual separation and Title focus；no header-control overlap or page-wide horizontal overflow was observed。
- Current screen size：passed visual inspection；the desktop sidebar and editor header rendered without overlap，and export remained accessible。
- Preview reload cleared the earlier 2 Vite WebSocket errors。They did not recur in the post-reload debug panel。
- Two fresh Firebase Auth App Check reCAPTCHA warnings did recur immediately after reload at the transient AI Studio Preview `run.app` origin。This remains an environment-specific Preview warning because the reCAPTCHA Enterprise key is restricted to the published custom domain；App Check enforcement remains off and authenticated journal data reloaded successfully。
- The production build warning remains accurately recorded：the minified JavaScript bundle is `1,246.70 kB`（gzip `343.12 kB`），above Vite's `500 kB` advisory threshold。It is non-blocking performance debt。
- No source、journal data、Firestore Rules、role、notification、Secret、deployment、sharing、or Publish change occurred。Responsive interaction QA is complete for the tested normal-user path；privileged RBAC E2E remains blocked by the missing role-management scripts and absent owner／admin setup。

### 2026-09-05 — RBAC CLI scripts restored locally

- Located two preserved source copies of `scripts/bootstrap-owner.ts` and `scripts/manage-role.ts`。The copies are byte-identical：SHA-256 `B82548E6A915175381A0A5DF78A89D0C9CBE454BEC8FC9A13055D57790F91D52` and `91A7E8144132E2DA300808C965851362790909659B2FB22533239A479E1AA8E3` respectively。
- Verified that the preserved source's `server/firebaseAdmin.ts`、`server/rbac.ts`、and `package.json` exactly match the current candidate before restoring the scripts。
- Restored only the two missing CLI files。No role input environment variable was present or populated。
- `tsc --noEmit` passed。Production build passed；Vite retained the non-blocking chunk advisory（JavaScript `1,246.10 kB`，gzip `343.10 kB`）。
- Both CLI commands were executed with all role inputs absent。`role:bootstrap-owner` exited `1` with the fixed rejection message，and `role:manage` exited `1` with the fixed rejection message。Neither command reached Firebase Admin initialization or performed a cloud mutation。
- The earlier “missing role scripts” packaging blocker is closed locally。Owner bootstrap、admin-role E2E、AI Studio synchronization、deployment、and Publish remain pending and require separate gates。

### 2026-09-05 — Canonical GitHub candidate assembled and verified on D drive

- Cloned `https://github.com/NNBtw/reflective-gemini-journal.git` into `D:\Lessons\Computing_Lessons\Google\Hack2skill (H2S)\Gen AI Academy APAC\Ideathon Challenge\reflective-gemini-journal` and created local branch `candidate/verified-2026-09-05` from initial commit `ada36d3`。GitHub remains the intended canonical source，but this candidate is not committed or pushed yet。
- Copied the verified application candidate and the latest five handoff documents into the clone。Excluded `.git`、`node_modules`、`dist`、`.firebase-config`、real `.env` files，and logs。
- Closed a second packaging gap：restored `firebase.json`、`scripts/test-firestore-rules.ps1`，and five test files from a preserved source after confirming the tested dependencies match the candidate。The restored suites cover Firestore Rules、location normalization、RBAC、notification safety，and crisis-resource determinism。
- Reviewed all five pnpm lifecycle-script placeholders。`pnpm-workspace.yaml` now permits only `esbuild`；`@firebase/util`、`@google/genai`、`protobufjs`，and optional native `re2` are denied。`pnpm install --frozen-lockfile` passed under pnpm `11.19.0`，and only esbuild `0.25.12`／`0.28.2` postinstall scripts ran。The lockfile SHA-256 still matches the verified source：`7E6A760F933968BAD42C037F63A09677B0A4B27B36BBD35E0CFC7014DC3FFF4B`。
- Both `bun.lock` and `pnpm-lock.yaml` are retained because the inherited AI Studio instructions use Bun while the reproducible canonical verification uses pnpm。For shared GitHub work，treat pnpm frozen install as the validation authority and do not regenerate either lockfile during unrelated feature work。
- Installed a repository-external portable Microsoft OpenJDK `21.0.12.1 LTS` under the adjacent `tooling` directory。The downloaded archive passed the official checksum comparison；SHA-256 `192441A9D27DA813BADA974BB88B4CF64D37A9589ED37F204374D411CA5CE07F`。No global Java install or persistent PATH change was made。
- Verification passed：`tsc --noEmit` exit `0`；production build completed；location tests `5/5`；security tests `13/13`；Firestore Rules emulator tests `30/30` with exit `0`。Expected `PERMISSION_DENIED` messages came from negative Rules cases。The existing Vite chunk advisory remains：JavaScript `1,246.70 kB`，gzip `343.12 kB`。
- Commit-candidate secret scan found no private key、GitHub token、OAuth client secret，or bearer JWT。The Firebase Web client key appears once in `firebase-applet-config.json`。Slack／Discord matches occur only in `tests/notifications.test.ts` validation fixtures。A generated `.firebase-config/configstore/firebase-tools.json` path exposed a missing ignore rule；`.firebase-config/` was added to `.gitignore` and the directory disappeared from Git status。
- Two manual PowerShell input issues caused no project mutation：an unterminated／non-executing here-string attempt was replaced with `Set-Content`，and two adjacent output expressions produced a parser error after the successful build。The actual build and all suites completed successfully。
- A Codex-sandbox read-only `git -C` inventory command was rejected by Git `dubious ownership` because the sandbox SID differs from the repository owner's SID。User-shell Git remained healthy；no global `safe.directory` exception or repository change was made，and pure file inspection completed the check。
- Initial `git add --all` emitted LF-to-CRLF working-copy warnings under the user's Git configuration。The first staged whitespace check exited `2` and identified inherited trailing spaces in three documents and five TypeScript import blocks，plus one extra blank line at the end of `index.html`。
- Added repository-level `.gitattributes` with `* text=auto eol=lf`，removed only the reported trailing whitespace，and reduced `index.html` to one final newline。A first `.gitattributes` command was accidentally concatenated with an unsubmitted output expression，and a first cleanup helper resolved relative paths against `C:\Windows\System32`；both attempts failed without changing the intended files。The corrected absolute-path cleanup succeeded。
- After `git add --renormalize .`，the Git index contains no CRLF／mixed entries；`git diff --cached --check` exits `0`，and the post-cleanup `tsc --noEmit` rerun exits `0`。These edits are formatting／repository hygiene only；runtime behavior is unchanged。
- Current gate：synchronize these updated documents into the D-drive clone，review the full staged file set and secret-scan classification，then create a local commit。Push、merge、deployment、Publish，owner bootstrap，and role mutation remain unperformed。
