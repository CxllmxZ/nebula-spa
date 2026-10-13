# Handover — Session 9.5 (AGENTS.md + Framework restructure)

**Date:** 2026-09-20
**Duration:** 1 full working day (คุยยาว)
**Focus:** AI Agent infrastructure + folder structure refactor + framework consistency

---

## 📋 Executive Summary

Session นี้เน้น **AI Agent infrastructure** (AGENTS.md + JSON analyzer) และ **folder restructure** (flat → nested per feature) เพื่อรองรับ scale ของ WEF (6 modules × ~90 scenarios)

**ผลลัพธ์:**
- ✅ AGENTS.md v3 (universal, ~260 lines) — พร้อมใช้กับ Copilot/Chat AI
- ✅ analyze-project.ps1 + .bat (JSON metadata generator)
- ✅ run-local.ps1 refactored (เพิ่ม featureLoop level)
- ✅ Folder restructure: `dashboard/search/*.ts` (nested per feature)
- ✅ verify-helpers.ts pattern verified (WEF `_shared/`)
- ⏸️ Pending: test AGENTS.md ที่บ้าน (บริษัทใช้ AI ไม่ได้)

---

## 🎯 Session Objectives

1. Push Nebula-Spa form login changes (จาก Session 9)
2. Update documentation (README + session summary MD)
3. Design AGENTS.md สำหรับ AI-assisted development
4. สร้าง infrastructure ให้ AI รู้ project structure
5. Restructure folder pattern (dashboard flat → nested) เพื่อรองรับ multi-feature per module

---

## ✅ COMPLETED WORK

### 1. Git Push Preparation

**Verified before push:**
- Modified: `Authen/Form-Login/form-auth.helper.ts`, `form-codegen.cjs`, `Test-Local/run-local.ps1`, `playwright.config.ts`, `pnpm-lock.yaml`
- Untracked: `Test-Local/Nebula-Spa/` (new project folder)
- ✅ Confirmed: `session-storage.json` + `state.json` + `profile/` NOT in git status (gitignore working)

**Encoding decision:**
- `chcp 437` ยึดไว้ (ไม่ใช่ 65001) — Unicode `›` แสดงเพี้ยน `ΓÇ║` แต่ compatible เครื่องอื่น (cosmetic only)

**Commit strategy discussed** (แต่ user ยังไม่ commit จริง):
- 3-4 commits แยก: helper/config + runner fix + Nebula setup + lockfile
- หรือ single commit (message ยาว) — ตามใจ user

---

### 2. FORM_LOGIN_STORAGE_STATE_SUPPORT.md (Session 9 summary)

**File:** `/mnt/user-data/outputs/FORM_LOGIN_STORAGE_STATE_SUPPORT.md`

**Content (11 sections):**
1. เป้าหมาย
2. ไฟล์ที่แก้
3. ไฟล์ที่เพิ่ม (Nebula folder)
4. Component-level changes (helper/codegen/config/runner)
5. Debug journey (Out-Host discovery)
6. Test data + verify flow
7. Known issues (Radix ID, save disabled, verify)
8. Encoding note
9. งานเหลือ (WEF verify, sessionStorage fixture, naming)
10. Env var contract
11. Verification checklist

---

### 3. README.md Updated

**File:** `/mnt/user-data/outputs/README.md`

**Changes:**
- Section 1 (usage) — เพิ่ม 3 authTypes concept (none/microsoft/form)
- Setup flow 5 steps สำหรับ Test-Local (install → project.config.json → setup auth → codegen test → run)
- Template `login.setup.ts` พร้อม comment
- Section 2 (structure) — 3-level hierarchy (Project → AccessFlow → Module)
- Env var contract table
- Universal infrastructure principles

---

### 4. Verify Helpers Pattern (WEF)

**File:** `Test-Local/WEF/_shared/verify-helpers.ts` (created in previous session, extended this session)

**Functions ครบ 6 ตัว:**
- `verifySearchResult(page, options)` — 3-category error (TABLE MISSING / NO DATA / MISMATCH)
- `verifyEmptyState(page, options)` — check "ไม่พบข้อมูล"
- `verifyRecordCount(page, options)` — verify row count
- `verifyFieldError(page, options)` — form validation
- `verifySuccessToast(page, options)` — success feedback
- `verifyNavigatedTo(page, options)` — URL navigation

**Format:** Box-formatted error with tag + context + fix hint

**Verified working:** CHASSIS001 test → showed `SEARCH RETURNED NO DATA` message correctly

**Refactored `dashboard-search.spec.ts`:**
- Removed inline `verifySearchResult` function
- Import from `../../_shared/verify-helpers` (later `../../../` after restructure)

---

### 5. AGENTS.md v3 (Universal Design)

**File:** `/mnt/user-data/outputs/AGENTS.md` (~260 lines)

**Design decisions after extensive debate:**

**Universal (not per-project):**
- Aligns with framework "universal" intent
- 1 file at root — no nested AGENTS.md
- Force framework consistency (prevent drift)
- **Excluded:** framework-specific hints (Angular/React) — Playwright is framework-agnostic

**7 Sections:**

| Section | Content |
|---|---|
| 1. Project Overview | Folder structure + auth types + flat/nested decision |
| 2. Universal Principles | Locator rules, verify, security |
| 3. Discovery Mechanism | JSON (Option A) vs workspace scan (Option B) |
| 4. Pattern Design Workflow | 3 cases with decision tree |
| 5. Locator Workflow | `_locators/` convention (MODULE-level, feature-named) |
| 6. Adding New Feature Workflow | 7-step process |
| 7. Decision Trees | When to add helper, extract shared, move to common |

**3 Cases decision tree (KEY concept):**

```
Case 1 — Add data row
  Signal: Feature exists + control type covered
  Files: 1 (data.ts)

Case 2 — Extend pattern
  Signal: Feature exists + new control type
  Files: 3 (types + helper + data)

Case 3 — New feature
  Signal: Feature doesn't exist
  Files: 4 new files in new folder + 1 locator file
```

**Key rules documented:**
- Never `exact: true` with Thai labels containing `/` or spaces
- Never auto-generated IDs (`#radix-*`, `#mat-*`)
- Never commit: `session-storage.json`, `state.json`, `profile/`, `.env`, `_locators/**`, `.agent-cache/*.json`
- Preserve Thai UI text exactly

---

### 6. Project Structure Analyzer

**Files created:**
- `/mnt/user-data/outputs/analyze-project.ps1` (~250 lines)
- `/mnt/user-data/outputs/analyze-project.bat`

**Purpose:** สร้าง `.agent-cache/project-structure.json` เพื่อให้ AI (Chat/Copilot) อ่าน metadata ทั้ง project

**JSON contents:**
- Project → Access Flow → Module → Feature hierarchy
- Files per feature (spec, helper, types, data, locators)
- Control types extracted from `types.ts` (regex parse)
- Test cases (id + scenario) extracted from `data.ts`
- authType per access flow (from project.config.json)

**Design decisions:**
- Global 1 file (not per-project) — regenerate ทีเดียวจบ
- Gitignored (per-user, regenerate เมื่อจำเป็น)
- Full metadata mode (not just filenames)
- Manual regeneration (`analyze-project.bat`)

**Bug fixed:** Flat module (WEF dashboard เดิม) ไม่ detect helper/types/data — refactored `Get-FeatureFiles` → `Build-Feature` function to handle both flat + nested

**BAT enhancement:** เพิ่ม `pause` unconditional (เห็นทั้ง success + error)

---

### 7. Folder Restructure: Flat → Nested

**Motivation:** Dashboard จะมี features มากกว่า 1 (Search + Export + Pagination) — flat ไม่ scale

**Migration (Option B — rename):**

```
Before:
dashboard/
├── dashboard-search.spec.ts
├── dashboard-search.helper.ts
├── dashboard-search.types.ts
└── dashboard-search.data.ts

After:
dashboard/
└── search/
    ├── search.spec.ts
    ├── search.helper.ts
    ├── search.types.ts
    └── search.data.ts
```

**Steps completed:**
1. ✅ `git mv` 4 files → `search/` folder + rename
2. ✅ Update imports:
   - Sibling: `./dashboard-search.X` → `./search.X`
   - Verify-helpers: `../../_shared/` → `../../../_shared/` (3 levels up now)
3. ✅ Verified via `git status` — 4 renames detected

---

### 8. run-local.ps1 Refactor

**File:** `/mnt/user-data/outputs/run-local.ps1` (1003 → 1189 lines)

**Changes:**
- เพิ่ม `:featureLoop` label ระหว่าง `moduleLoop` และ `scopeLoop`
- Auto-detect: ถ้า module มี subfolder → feature menu; ถ้าไม่มี → skip (backward compat)
- Variables: `$featurePath`, `$selectedFeature`, `$hasFeatureLevel`, `$scopeLabelBase`, `$scopeTitle`
- Post-run menu 2 versions:
  - Flat: 5 options (เดิม)
  - Nested: 6 options (เพิ่ม "Change feature")
- ตัวเลือก `[ Run ALL features in <module> ]` สำหรับ nested case

**Menu flow ใหม่:**

```
Nested:  Project → Access Flow → Module → Feature → Test scope → Spec file
Flat:    Project → Access Flow → Module →           Test scope → Spec file
```

**Backward compat:** Nebula-Spa `booking/` + WEF `car-model/` ยังใช้ flat = ไม่กระทบ

---

### 9. run-codegen.ps1 — NO CHANGE NEEDED

**Verified:** Structure ของ run-codegen = `Project → Access Flow → Codegen Mode → URL input`

**ไม่มี module/feature selection** — user type URL ตรงๆ → codegen record ไม่กระทบจาก folder restructure

---

### 10. `_locators/` Convention Revision

**Final decision (after 2 iterations):**

**Location:** `<module>/_locators/<feature>.ts` (module-level, feature-named)

**NOT:** `<module>/<feature>/_locators/raw-codegen.ts` (per-feature, ยกเลิก)

**Rationale:** WEF Dashboard: search + export + pagination share fields (dealer, dates, dropdowns) → reuse ได้ง่าย

**AGENTS.md updated:**
- Section 1 folder tree — `_locators/` moved to module level
- Section 5 workflow — path + naming convention
- Section 6 order — codegen first → paste → scenarios → skeleton

---

### 11. .gitignore Additions

**Content added:**
```gitignore
# AI Agent artifacts
.agent-cache/
**/_locators/
```

**Note:** `**/_locators/` ใช้ pattern เดียวไม่ว่า _locators จะอยู่ระดับ feature หรือ module

---

## 🎨 KEY DEBATES + DECISIONS

### D1: Universal vs Per-Project AGENTS.md

**Winner:** Universal (1 file at root)

**Rationale:**
- Framework "universal" ตาม design intent
- Force discipline (refactor แทน exception)
- Onboarding fast (1 file)
- 1 team + < 10 projects — ยังจัดการได้

**Not concern:** ~5% accuracy loss vs nested — trade-off คุ้ม

---

### D2: JSON vs Workspace Scan

**Winner:** BOTH (user choice per session)

**Reasoning:**
- Chat AI (Claude web) → need JSON (no workspace access)
- Copilot in VS Code → workspace scan works natively
- Global JSON, gitignored, regenerate as needed

---

### D3: `_locators/` Placement

**Iteration 1:** Per feature (`<feature>/_locators/raw-codegen.ts`)
**Iteration 2 (FINAL):** Per module (`<module>/_locators/<feature>.ts`)

**Reason for change:** Reuse — WEF features share filter fields, module-level enables sharing

---

### D4: Reporter Approach (REJECTED)

**Proposal:** Custom Playwright reporter to auto-classify errors (DATA MISSING / SERVER ERROR / etc.)

**User rejected:** ซับซ้อนไป, 90 scenario × complex reporter = maintain ไม่ไหว

**Kept:** Manual verify-helpers.ts (simpler, explicit)

---

### D5: Framework Hints in AGENTS.md (SKIPPED)

**Proposed:** เพิ่ม Angular/React quirks section

**User pointed out:** Playwright is framework-agnostic — quirks visible from codegen output → AI infer เอง

**Decision:** ตัด framework hints, keep universal only

---

### D6: 3 Cases Terminology (KEY concept aligned)

**Terminology:**
- **Module** = 1 หน้า/menu (Dashboard, Car Model)
- **Feature** = 1 function ในหน้า (Search, Export, Pagination)
- **Pattern** = โครง test flow ของ feature (usually 1 pattern per feature)
- **Test case** = 1 scenario (row ใน data.ts)
- **Scenario** = business requirement (จาก QA Excel)

**3 Cases:**
- Case 1: pattern stable, add data (1 file)
- Case 2: extend pattern, new control type (3 files)
- Case 3: new feature (4 files new folder)

---

## 🐛 ISSUES ENCOUNTERED + FIXES

### Issue 1: `exact: true` bug on Thai text

**Symptom:** TC002 (Search by Dealer) + TC003 (Search by Chassis) → `locator not found`

**Root cause:** `dashboard-search.helper.ts` case `namedTextbox` ใช้ `exact: true`
- `'รหัส Dealer / ชื่อ Dealer'` — Thai + space + slash
- Playwright's accessible name calculation อาจต่างจาก string ที่ pass 1-2 characters

**Fix suggested:** Remove `exact: true` (partial match) or use RegExp

**Status:** User confirmed field structure (based on Copilot design) — index correct

**Actual test failures:** DATA MISSING (DEALER001, CHASSIS001 records ไม่มีใน DB) — verify-helpers ทำงานถูก

---

### Issue 2: Microsoft Auth Session Lost Outside Office

**Symptom:** Setup ในบริษัท → move state.json มาที่บ้าน → ต้อง re-login ทุกครั้ง

**Diagnosis:** ไม่ใช่ code bug — Azure AD Conditional Access Policy (Trusted Location = office IP)

**Verified code correct:**
- `microsoft-profile.cjs` uses `launchPersistentContext` + `saveStorageState({ indexedDB: true })`
- Approach 100% correct

**Solutions offered:**
1. Setup + test on same network (each location)
2. VPN into office network
3. Accept — re-setup daily (5 นาที)

**Status:** User accepted this as expected security behavior

---

### Issue 3: Flat Module Not Detected by Analyzer

**Symptom:** JSON output แสดง WEF dashboard เป็น 1-file (แค่ spec), missing helper/types/data

**Root cause:** `analyze-project.ps1` flat module case:
- `if ($featureDirs.Count -eq 0)` branch เดิมเพิ่มแค่ spec file
- ไม่ได้เรียก `Get-FeatureFiles` เพื่อ detect siblings

**Fix:** Refactored:
- เพิ่ม `Build-Feature` function ที่ใช้ได้ทั้ง flat + nested
- Flat case ตอนนี้ call `Build-Feature -BasePath $moduleDir -FeatureName $featureName`

**Status:** ✅ Fixed, ready to test

---

### Issue 4: BAT ปิดทันทีหลังรัน

**Symptom:** analyze-project.bat รันเสร็จ terminal ปิด, เห็นแค่ error case

**Fix:** เพิ่ม `pause` unconditional หลัง PowerShell exit

**Status:** ✅ Fixed

---

### Issue 5: Retry Behavior in Local Run

**Symptom:** Test fail แล้ว retry 2-3 รอบ → slow feedback

**Diagnosis:** `run-local.ps1` line 9: `$env:CI = "true"` → playwright.config.ts sees CI → retries: 2

**Solution offered:**
- Approach A: Remove `$env:CI = "true"` (simple)
- Approach B: Override with `PLAYWRIGHT_LOCAL_RUN` env var (safer)

**Status:** ⏸️ Discussed but not applied (user moved on to AGENTS.md work)

---

## 📁 FILE LOCATIONS

### Outputs (this session — copy to repo):

| File | Target path in repo |
|---|---|
| `AGENTS.md` | `D:\n8n\ttest-playwright\AGENTS.md` |
| `analyze-project.ps1` | `D:\n8n\ttest-playwright\analyze-project.ps1` |
| `analyze-project.bat` | `D:\n8n\ttest-playwright\analyze-project.bat` |
| `run-local.ps1` | `D:\n8n\ttest-playwright\Test-Local\run-local.ps1` |
| `README.md` | `D:\n8n\ttest-playwright\README.md` |
| `FORM_LOGIN_STORAGE_STATE_SUPPORT.md` | `D:\n8n\ttest-playwright\FORM_LOGIN_STORAGE_STATE_SUPPORT.md` |
| `gitignore-additions.txt` | Append to `.gitignore` |

### Existing repo files (previous sessions):

- `Authen/Microsoft/setup-microsoft-auth.ps1` (Azure AD SSO setup)
- `Authen/Form-Login/form-auth.helper.ts` (saveStorageState + saveSessionStorage)
- `Authen/Form-Login/form-codegen.cjs` (dual-mode codegen)
- `Test-Local/WEF/_shared/verify-helpers.ts` (6 functions)
- `Test-Local/WEF/Microsoft-Login/dashboard/search/*.ts` (after restructure)
- `Test-Local/Nebula-Spa/Admin-Login/*` (booking test)
- `playwright.config.ts` (with AUTH_KIND routing)

### Generated at runtime (gitignored):

- `.agent-cache/project-structure.json` (from analyze-project.bat)
- `_locators/**` (raw codegen dumps per module)
- `Authen/Microsoft/state.json` + `profile/` (auth artifacts)
- `Test-Local/**/session-storage.json` (auth artifacts)

---

## ⏭️ PENDING ACTIONS

### High priority (next session):

1. **Test AGENTS.md at home**
   - บริษัทใช้ Copilot/Claude ที่เครื่อง user ไม่ได้ → ต้องไปทำที่บ้าน
   - Test A (Chat AI): paste AGENTS.md + JSON → prompt Case 1 → verify response
   - Test B (Copilot inline): เปิด data.ts → comment → verify suggest ตาม pattern
   - Test C (complex): prompt Case 3 (new feature) → verify skeleton generation

2. **Copy outputs → repo + commit + push**
   - AGENTS.md at root
   - analyze-project.ps1/.bat at root
   - run-local.ps1 in Test-Local/
   - Update .gitignore
   - Suggested commit: `feat: add AGENTS.md + project analyzer + featureLoop refactor`

3. **Regenerate JSON cache**
   ```powershell
   analyze-project.bat
   ```
   Verify JSON contains dashboard/search feature with correct 4-file structure

4. **Verify restructured spec runs**
   ```powershell
   run-local.bat
   # WEF → Microsoft-Login → dashboard → search → ALL tests
   ```

### Medium priority:

5. **WEF Dealer verification**
   - Verify `saveSessionStorage()` still works
   - Verify run-local.ps1 detects Kind = `sessionStorage`
   - If Dealer test to run → build sessionStorage inject fixture in playwright.config.ts (currently throws error)

6. **Retry behavior fix**
   - Remove or override `$env:CI = "true"` in run-local.ps1
   - Session ended before applied

7. **Migrate _locators to module level** (if search's `_locators/` exists)
   ```powershell
   # ถ้ามี:
   mv Test-Local\WEF\Microsoft-Login\dashboard\search\_locators\*.ts `
      Test-Local\WEF\Microsoft-Login\dashboard\_locators\search.ts
   rmdir Test-Local\WEF\Microsoft-Login\dashboard\search\_locators
   ```

### Low priority:

8. **Dashboard-search bugs (if not fixed)**
   - Fix `exact: true` in helper.ts case `namedTextbox` (if not resolved)
   - Seed DEALER001 + CHASSIS001 data for TC002 + TC003

9. **Nebula Session 10**
   - LINE integration for Nebula-Spa
   - Booking notification workflow

10. **Nebula test bugs**
    - Radix ID (`#radix-_r_p_`) — replace with role + name
    - Save button disabled logic (radio = current status)
    - Missing verify after save

---

## 🚧 KNOWN BLOCKERS

### 1. AI at Office Machine
- User's company VS Code cannot use Copilot at เครื่อง user
- Chat AI (Claude web) เข้าถึงได้ผ่าน browser?
- Workaround: ทดสอบ AGENTS.md ที่บ้าน หรือขอเครื่องเพื่อนช่วย

### 2. WEF Dealer sessionStorage Inject
- `playwright.config.ts` throws error สำหรับ `AUTH_KIND=sessionStorage`
- ต้องสร้าง custom fixture: `context.addInitScript()` inject sessionStorage before page load
- Business tests ยังรันไม่ได้จนกว่าจะสร้าง fixture

### 3. Test Data Seeding
- TC002 (DEALER001) + TC003 (CHASSIS001) records don't exist in WEF DB
- Verify-helpers reports "SEARCH RETURNED NO DATA" correctly — infrastructure OK
- Need to seed DB or update test values to existing records

---

## 🔄 HANDOVER — Start of Next Session

### Context to paste in new chat:

```
Session 9.5 handover (paste จาก /mnt/user-data/outputs/handover-session-9.5.md)

Current state:
- ttest-playwright framework universal (WEF + Nebula-Spa)
- AGENTS.md v3 พร้อมใช้ (copy ไปที่ D:\n8n\ttest-playwright\AGENTS.md แล้ว)
- Folder restructure: dashboard/search/ (nested)
- run-local.ps1 มี featureLoop

Immediate tasks:
1. Test AGENTS.md workflow (Chat AI ที่บ้าน)
2. Commit + push AGENTS.md + analyze-project + run-local
3. Verify JSON cache generation
```

### Files to have ready:

- `AGENTS.md` (paste เนื้อหา)
- `.agent-cache/project-structure.json` (paste เนื้อหา, ถ้ามี)
- This handover doc

### First prompt template (new session):

```
เริ่ม session ใหม่ต่อจาก session 9.5 (paste handover)

ทำ [X] — [describe first task]
```

---

## 📝 QUICK REFERENCE

### 3 Cases Decision (สำคัญที่สุด):

| Case | Signal | Files touched |
|---|---|---|
| 1 | Same feature, control type covered | 1 (data.ts) |
| 2 | Same feature, new control type | 3 (types + helper + data) |
| 3 | New feature | 4 new (spec + helper + types + data) + 1 locator |

### Terminology:

- **Module** = 1 หน้า (Dashboard)
- **Feature** = 1 function (Search)
- **Pattern** = โครง test flow
- **Test case** = 1 row ใน data.ts
- **Scenario** = business req (จาก QA Excel)

### Workflow adding new feature (Case 3):

```
1. Codegen → save to <module>/_locators/<feature>.ts
2. Get scenarios from QA Excel
3. Create <module>/<feature>/ folder + 4 files
4. AI composes test steps from scenarios + locators
5. Fill TODO markers
6. Run + verify + regenerate JSON cache
```

### Prompt template (AI Agent):

```
@workspace ตาม AGENTS.md + project-structure.json

Case: [1 | 2 | 3]
Feature: <name>

[Case 1] Scenario: <scenario> Value: <value> Expected: <expected>
[Case 2] New control type: <describe>  
[Case 3] Locators file: <path>, Scenarios: <list>, Reference: <folder>

Generate code
```

---

## Metadata

- **Session number:** 9.5
- **Continues from:** Session 9 (Form Login storageState + Nebula setup)
- **Related docs:**
  - `handover-session-9.md`
  - `LOCAL_RUNNER_CHANGELOG.md`
  - `FORM_LOGIN_STORAGE_STATE_SUPPORT.md`
- **Framework version:** ttest-playwright (universal design)
- **Total files created/modified this session:** 7 (outputs) + 6 (repo, existing paths)
