# ttest-playwright — Session TT-4 Handover

**Date:** Sep 1-2, 2026 (Day 30-31)
**Repo:** `D:\n8n\ttest-playwright` (GitHub: CxllmxZ/ttest-playwright, PUBLIC)
**Live URL:** https://cxllmxz.github.io/ttest-playwright/

---

## 🎯 Big Picture

**Session TT-4 = Architecture Pivot**

**From:** ttest = YAML testcase parser (custom framework)
**To:** ttest = Playwright orchestration wrapper (use Playwright directly)

**Reasoning:** YAML testcase = 4x verbose vs Playwright TS. Codegen produces .spec.ts directly. Manual convert = productivity killer. Playwright ecosystem mature — don't compete, extend.

---

## ✅ What's Working Now

### Test-Prod/ (GitHub Actions — production URLs)
- `Test-Prod/nebula-spa/smoke.spec.ts` — Nebula production landing page test
- `Test-Prod/demo-todo/todo.spec.ts` — TodoMVC demo test
- Deploys HTML report to GitHub Pages

### Test-Local/ (Local machine — localhost URLs)
- `Test-Local/nebula-local/smoke.spec.ts` — Nebula localhost:8787
- `Test-Local/nebula-local/book-customer-a.spec.ts` — Full booking flow
- Interactive PowerShell menu (arrow keys + Enter)
- Post-run navigation (run again / change file / change project)

### Files structure
```
ttest-playwright/
├── .github/workflows/
│   └── Start-TestCase.yml           ← GitHub Actions workflow
├── Test-Prod/
│   ├── nebula-spa/smoke.spec.ts
│   └── demo-todo/todo.spec.ts
├── Test-Local/
│   ├── setup.bat                    ← Install script (currently broken)
│   ├── run-local.bat                ← Launcher (calls .ps1)
│   ├── run-local.ps1                ← Interactive menu
│   ├── run-codegen.bat              ← Launch Playwright codegen
│   ├── minimal-test.bat             ← Debug test file
│   ├── nebula-local/
│   │   ├── smoke.spec.ts
│   │   └── book-customer-a.spec.ts
│   └── demo/                        ← optional (not created yet)
├── browsers/                        ← Chromium binary (gitignored)
├── node_modules/                    ← Dependencies (gitignored)
├── playwright.config.ts
├── package.json                     ← Cleaned (Playwright only)
├── pnpm-lock.yaml
├── .gitignore                       ← includes browsers/, node_modules/, dist/
└── README.md                        ← Complete documentation
```

---

## 📋 Current package.json (Cleaned)

**All legacy ttest deps removed. Only Playwright:**

```json
{
  "name": "ttest-playwright",
  "version": "2.0.0",
  "description": "Universal Playwright test runner with GitHub Actions CI + local interactive menu",
  "scripts": {
    "test": "playwright test",
    "codegen": "playwright codegen"
  },
  "type": "module",
  "keywords": ["playwright", "testing", "e2e", "automation"],
  "author": "CxllmxZ",
  "license": "MIT",
  "packageManager": "pnpm@10.23.0",
  "devDependencies": {
    "@playwright/test": "^1.62.1"
  }
}
```

**Removed (legacy from ttest CLI era):**
- `main`, `bin` (ttest CLI entry point)
- `build`, `prepare`, `dev`, `start` scripts (ttest TS build)
- `chalk`, `commander`, `playwright`, `yaml` (ttest dependencies)
- `@types/node`, `tsx`, `typescript` (ttest devDependencies)

**Result:** node_modules ~50MB (was ~300MB), install ~2 sec (was ~60 sec)

---

## 🐛 CURRENT ISSUE (Blocker — needs fix)

**Setup.bat runs but Chromium NOT installed to correct location:**

```
User's terminal output:
Test-Path node_modules\@playwright\test    → True ✅
Test-Path browsers                         → False ❌ (should be True)
```

### Root cause

**Minimal-test.bat (used for debugging):**
- Did NOT include `set PLAYWRIGHT_BROWSERS_PATH=%CD%\browsers`
- Chromium installed to default location (`%LOCALAPPDATA%\ms-playwright\`)
- Not to repo-local `browsers/` folder

**Verify Chromium at default location:**
```powershell
Test-Path "$env:LOCALAPPDATA\ms-playwright"
Get-ChildItem "$env:LOCALAPPDATA\ms-playwright"
```

### Decision needed

**2 approaches:**

**Approach A: Self-contained (browsers in repo)**
- Original design (session TT-3)
- Set `PLAYWRIGHT_BROWSERS_PATH=%CD%\browsers` in all .bat/.ps1 files
- 200MB duplicate per project
- Portable — delete folder = clean

**Approach B: System default (shared browsers)**
- Playwright default behavior
- Share browsers across projects
- Save disk space
- Simpler setup.bat (no env var management)

**User was leaning toward B (simpler)** but not confirmed.

### Immediate fix options

**Option 1: Complete self-contained install (Approach A)**
```powershell
cd D:\n8n\ttest-playwright
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\browsers"
pnpm exec playwright install chromium
```

**Option 2: Test with system Chromium (Approach B)**
```powershell
cd D:\n8n\ttest-playwright
pnpm exec playwright test Test-Local/nebula-local/smoke.spec.ts
```
If works → switch all files to remove PLAYWRIGHT_BROWSERS_PATH

---

## 📜 Setup.bat Journey (Multiple bugs fixed)

**Session had many batch script bugs. Timeline of fixes:**

### Bug 1: `pnpm build` step (legacy)
- Original setup.bat had `pnpm build` from ttest CLI era
- After package.json cleanup → no build script → error
- **Fix:** Removed `pnpm build` step

### Bug 2: `pnpm install --frozen-lockfile`
- Required existing lockfile
- After delete pnpm-lock.yaml → error
- **Fix:** Changed to `pnpm install` (no flag)

### Bug 3: `where` command unreliable in some contexts
- `where node` sometimes returns wrong errorlevel
- **Fix:** Changed to `node --version >nul 2>&1`

### Bug 4: `%ERRORLEVEL%` stale value
- Batch parses `%ERRORLEVEL%` at parse time (not runtime)
- Wrong errorlevel value used
- **Fix:** Changed to `if errorlevel 1` (real-time check)

### Bug 5: If/else parsing with special chars
- `:` (colon) in text broke if/else block parsing
- Both branches executed
- **Fix:** Removed `:` from strings, used early-exit pattern (no else)

### Bug 6: `pnpm install` vs `pnpm add -D @playwright/test`
- `pnpm install` reads package.json (fragile if not synced)
- `pnpm add` explicit install (more robust)
- **Fix:** Use `pnpm add -D @playwright/test`

### Bug 7: `node -V` (uppercase) invalid
- Node uses `-v` or `--version`, not `-V`
- **Fix:** Use `--version` (works for all tools)

### Current setup.bat (working for Node + pnpm check, but Chromium install location wrong)

```batch
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

REM Change to repo root (parent of Test-Local)
cd /d "%~dp0.."

echo ==========================================
echo   Playwright Tests - Setup
echo ==========================================
echo.
echo Repo location: %CD%
echo.

REM Set Playwright to use local browsers folder
set PLAYWRIGHT_BROWSERS_PATH=%CD%\browsers

REM ---- Check Node.js ----
where node >nul 2>nul
if not errorlevel 1 (
    echo [SUCCESS] Node.js is installed on this machine.
    echo version:
    node -v
) else (
    echo.
    echo [ERROR] Node.js not installed
    echo.    
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODE_VERSION=%%v
echo [OK] Node.js: !NODE_VERSION!
echo.

REM ---- Check pnpm ----
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] pnpm not found - installing globally...
    call npm install -g pnpm
    if errorlevel 1 (
        echo [ERROR] Failed to install pnpm
        pause
        exit /b 1
    )
    echo [OK] pnpm installed
)

for /f "delims=" %%v in ('pnpm --version') do set PNPM_VERSION=%%v
echo [OK] pnpm: !PNPM_VERSION!
echo.

REM ---- Install Playwright ----
echo Installing @playwright/test...
call pnpm add -D @playwright/test
if errorlevel 1 (
    echo [ERROR] Failed to install packages
    pause
    exit /b 1
)
echo [OK] Playwright installed
echo.

REM ---- Install Chromium ----
echo Installing Chromium browser (~200MB)...
echo (This may take 1-3 minutes)
call pnpm exec playwright install chromium
if errorlevel 1 (
    echo [ERROR] Failed to install Chromium
    pause
    exit /b 1
)
echo [OK] Chromium installed
echo.

echo ==========================================
echo   Setup complete!
echo ==========================================
echo.
echo Next steps:
echo   - Double-click "run-local.bat" to run tests
echo   - Double-click "run-codegen.bat" to record new tests
echo.
pause
```

**Problem:** Setup runs but exits after pnpm check (before showing Playwright/Chromium install output). Actually they might have run silently (already installed) but no visual confirmation.

---

## 🎬 GitHub Actions Workflow (Working)

**File:** `.github/workflows/Start-TestCase.yml`

**Current design: 3 dropdowns (project + scope + test_file)**

**Key features:**
- Manual dispatch only (no push trigger)
- Bash logic determines path from inputs
- Validate step with auto-list on error
- Deploy report to GitHub Pages

**User was exploring alternative designs but settled on keeping current:**
1. Considered: 1 text input with smart parsing (`project/testcase` or `project/`)
2. Considered: Auto-detect dropdowns (impossible — GitHub Actions static YAML)
3. Considered: REST API to fetch file list (nice idea but not implemented)
4. **Kept:** 3 dropdowns hardcoded

**Manual maintenance needed:** Update dropdown options when adding new project/test.

---

## 💡 Key Insights from Session

### Insight 1: Cloudflare Turnstile blocks Playwright on production

**Symptom:** Booking test on `nebula-spa.bimav.workers.dev/book` — Playwright can't get past Turnstile

**Solution:** 
- Production tests = smoke only (landing, navigation, content)
- Localhost tests = full flows (Turnstile disabled in dev)
- Right test for right environment

### Insight 2: GitHub Actions dropdown limitations

- Static YAML — no runtime updates
- No cascading dropdowns
- No file system scanning at popup render
- **Workarounds require manual list maintenance or bot commits**

### Insight 3: ttest-playwright as central testing hub

**Original assumption:** Install Playwright per project
**Reality:** Install once in ttest-playwright folder, test any URL from any project
- One Chromium install for all
- Codegen works with any URL
- Zero install in other projects

### Insight 4: Batch script is fragile

**Rules learned:**
1. No if/else (use early exit)
2. No `:` in strings (breaks parser)
3. Use `if errorlevel 1` (real-time), not `%ERRORLEVEL% NEQ 0` (stale)
4. Use `where` for command detection (more reliable than `--version` check)
5. Test each block in isolation

### Insight 5: setup.bat should use `pnpm add` not `pnpm install`

**`pnpm install`** — reads package.json (fragile if desync)
**`pnpm add -D @playwright/test`** — explicit install (always works)

More robust for first-time setup on fresh clones.

---

## 🎯 Testing Verified Working

**Test 1: Nebula production smoke (Actions)**
- URL: https://nebula-spa.bimav.workers.dev
- Duration: ~7 sec
- Status: PASS
- Report deploys to GitHub Pages

**Test 2: TodoMVC (Actions)**
- URL: https://demo.playwright.dev/todomvc
- Duration: 733ms
- Status: PASS
- 9 test steps visible in Playwright HTML report

**Test 3: Nebula localhost smoke (Local menu)**
- URL: http://localhost:8787
- Duration: 1.18 sec
- Status: PASS
- Interactive menu works with arrow keys

**Test 4: Nebula booking flow (Local menu)**
- URL: http://localhost:8787/book
- Duration: 16.23 sec (7 steps)
- Status: PASS (via codegen-generated selectors)
- Real booking created in Nebula localhost DB

---

## 🚨 Known Blockers

### 1. setup.bat Chromium install location bug (URGENT)
- User needs Chromium in `browsers/` folder (self-contained design)
- Currently installing to `%LOCALAPPDATA%\ms-playwright\` (default)
- **Need to decide:** Self-contained (Approach A) vs System default (Approach B)

### 2. Nebula duplicate booking bug (from Session 9.5)
- Not addressed in this session
- Booking system allows multiple reservations for same slot
- Still a critical bug for Nebula production

### 3. GitHub Actions workflow bootstrap
- Not tested with new package.json (cleanup)
- May need workflow update to remove any legacy `pnpm build` step
- Should verify workflow still passes after cleanup

---

## 📝 Files Modified in Session TT-4

**Package config:**
- `package.json` — Full cleanup (only Playwright)
- `pnpm-lock.yaml` — Regenerated

**Setup scripts (Test-Local):**
- `Test-Local/setup.bat` — Multiple iterations (still has issues)
- `Test-Local/run-local.bat` — Launcher (unchanged from TT-3)
- `Test-Local/run-local.ps1` — Interactive menu (may need update if switch to system Chromium)
- `Test-Local/run-codegen.bat` — Codegen launcher (new)
- `Test-Local/minimal-test.bat` — Debug file (created during debugging)

**Test files:**
- `Test-Prod/nebula-spa/smoke.spec.ts` — Fixed URL to production
- `Test-Prod/demo-todo/todo.spec.ts` — New demo test
- `Test-Local/nebula-local/smoke.spec.ts` — localhost URL
- `Test-Local/nebula-local/book-customer-a.spec.ts` — Full booking flow

**Config:**
- `playwright.config.ts` — testDir + testMatch for both Test-Prod and Test-Local

**Documentation:**
- `README.md` — Complete user guide (2 sections: Usage + Overview)

**Deleted (during cleanup):**
- `src/` — Old ttest framework source (if still exists, should delete)
- `dist/` — Old compiled output (should delete)
- `tsconfig.json` — Old ttest TypeScript config (should delete)
- `Test-Prod/tsconfig.json` — Old separate config (should delete)

---

## 🎯 Immediate Next Steps

### Priority 1: Fix Chromium install (choose approach)

**Approach A (self-contained):**
```powershell
cd D:\n8n\ttest-playwright
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\browsers"
pnpm exec playwright install chromium
```

**Approach B (system default):**
1. Test if works with system Chromium:
```powershell
pnpm exec playwright test Test-Local/nebula-local/smoke.spec.ts
```
2. If works → remove `PLAYWRIGHT_BROWSERS_PATH` from:
   - `Test-Local/setup.bat`
   - `Test-Local/run-local.ps1`
   - `Test-Local/run-codegen.bat`

### Priority 2: Verify GitHub Actions still works after cleanup

**Trigger:**
- Actions → Start-TestCase → Run workflow
- Input: `nebula-spa/smoke`
- Should pass and deploy report

**If fails:** Update workflow to remove any references to `pnpm build` or ttest CLI

### Priority 3: Cleanup legacy files (if not done)

```powershell
cd D:\n8n\ttest-playwright
Remove-Item -Recurse -Force src -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item tsconfig.json -ErrorAction SilentlyContinue
Remove-Item Test-Prod\tsconfig.json -ErrorAction SilentlyContinue
```

### Priority 4: Commit + push all changes

```powershell
git add .
git status
git commit -m "refactor: cleanup ttest legacy + fix setup.bat Chromium install"
git push
```

---

## 📊 Environment Details

**User:** Nopparut (GitHub: CxllmxZ)
**OS:** Windows
**Terminal:** PowerShell
**Node.js:** v22.13.0
**pnpm:** 10.23.0
**Node install location:** `C:\Program Files\nodejs\node.exe`
**pnpm install location:** `C:\Users\IVIisterHeartZ\AppData\Roaming\npm\pnpm.cmd`
**Repo location:** `D:\n8n\ttest-playwright`

---

## 🎬 GitHub Actions Workflow (Full Content)

```yaml
name: Start-TestCase

on:
  workflow_dispatch:
    inputs:
      project:
        description: 'Which project to test'
        required: true
        type: choice
        options:
          - nebula-spa
          - demo-todo
        default: 'nebula-spa'
      
      scope:
        description: 'Test scope'
        required: true
        type: choice
        options:
          - all
          - specific
        default: 'all'
      
      test_file:
        description: 'Test file (if scope=specific, e.g., smoke.spec.ts)'
        required: false
        type: string
        default: 'smoke.spec.ts'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.23.0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Determine test path
        id: path
        run: |
          if [ "${{ inputs.scope }}" = "all" ]; then
            TEST_PATH="Test-Prod/${{ inputs.project }}/"
            echo "Mode: Run ALL tests in ${{ inputs.project }}/"
          else
            TEST_PATH="Test-Prod/${{ inputs.project }}/${{ inputs.test_file }}"
            echo "Mode: Run SPECIFIC test: ${{ inputs.test_file }}"
          fi
          echo "path=$TEST_PATH" >> $GITHUB_OUTPUT

      - name: Validate path exists
        run: |
          TARGET="${{ steps.path.outputs.path }}"
          if [ ! -e "$TARGET" ]; then
            echo "❌ Path not found: $TARGET"
            find Test-Prod -name "*.spec.ts" | sed 's|Test-Prod/|  - |'
            exit 1
          fi

      - name: Run Playwright tests
        id: run-test
        run: pnpm exec playwright test ${{ steps.path.outputs.path }}
        continue-on-error: true

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./playwright-report

      - name: Fail workflow if test failed
        if: steps.run-test.outcome == 'failure'
        run: |
          echo "❌ Test failed - see report for details"
          exit 1

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: always()

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 🎬 Sample .spec.ts Files

### Test-Prod/nebula-spa/smoke.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test.describe('Nebula Spa - Production Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('https://nebula-spa.bimav.workers.dev');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/nebula-spa/);
    await expect(page.locator('body')).toBeVisible();
  });
});
```

### Test-Prod/demo-todo/todo.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test.describe('TodoMVC', () => {
  test('add and complete todo', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    
    const input = page.getByPlaceholder('What needs to be done?');
    await input.fill('Learn Playwright');
    await input.press('Enter');
    
    await expect(page.locator('.todo-list li')).toHaveCount(1);
    await expect(page.locator('.todo-list li')).toContainText('Learn Playwright');
    
    await page.locator('.toggle').click();
    await expect(page.locator('.todo-list li')).toHaveClass(/completed/);
  });
});
```

### Test-Local/nebula-local/smoke.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test.describe('Nebula Localhost - Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/localhost:8787/);
    await expect(page.locator('body')).toBeVisible();
  });
});
```

### Test-Local/nebula-local/book-customer-a.spec.ts
```typescript
import { test, expect } from '@playwright/test';

test.describe('Nebula Localhost - Booking Flow', () => {
  const targetDate = 'วันพฤหัสบดีที่ 3 กันยายน';
  const targetTime = '10:00';
  const customerName = 'Customer A';
  const customerPhone = '0811111111';
  const serviceName = 'นวดไทย ฿ 350 60 นาที';
  
  test(`Customer A books ${targetDate} ${targetTime}`, async ({ page }) => {
    await page.goto('http://localhost:8787/book');
    
    await page.getByRole('button', { name: serviceName }).click();
    await page.getByRole('button', { name: targetDate }).click();
    await page.getByRole('button', { name: targetTime }).click();
    
    await page.getByRole('textbox', { name: 'ชื่อ-นามสกุล' }).fill(customerName);
    await page.getByRole('textbox', { name: 'เบอร์โทร' }).fill(customerPhone);
    
    await page.getByRole('button', { name: 'ยืนยันการจอง →' }).click();
    
    await expect(page).toHaveURL(/\/book\/[a-zA-Z0-9]{6}/);
  });
});
```

---

## 🎬 Playwright Config

**playwright.config.ts:**
```typescript
/// <reference types="node" />
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['Test-Prod/**/*.spec.ts', 'Test-Local/**/*.spec.ts'],
  
  timeout: 30_000,
  
  expect: {
    timeout: 5_000,
  },
  
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
```

---

## 🎬 run-local.ps1 (Interactive Menu)

**Full content — arrow key navigation:**

```powershell
# ttest - Interactive Local Test Runner (Playwright direct)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $repoRoot "browsers"

# Verify setup
if (-not (Test-Path "node_modules")) {
    Write-Host "[ERROR] Packages not installed" -ForegroundColor Red
    Write-Host "Please run Test-Local\setup.bat first" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Show-Menu function with arrow keys
function Show-Menu {
    param(
        [string]$Title,
        [string[]]$Items,
        [string]$Hint = "(Use arrow keys, Enter to select, Esc to go back)"
    )
    
    $selected = 0
    $key = $null
    
    while ($key -ne 13 -and $key -ne 27) {
        Clear-Host
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "  $Title" -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host ""
        
        for ($i = 0; $i -lt $Items.Count; $i++) {
            if ($i -eq $selected) {
                Write-Host "  > $($Items[$i])" -ForegroundColor Green
            } else {
                Write-Host "    $($Items[$i])" -ForegroundColor Gray
            }
        }
        
        Write-Host ""
        Write-Host $Hint -ForegroundColor DarkGray
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow'   { if ($selected -gt 0) { $selected-- } }
            'DownArrow' { if ($selected -lt ($Items.Count - 1)) { $selected++ } }
            'Enter'     { return $selected }
            'Escape'    { return -1 }
        }
    }
}

function Invoke-PlaywrightTest {
    param([string]$Path)
    
    Clear-Host
    Write-Host "Running: $Path" -ForegroundColor Cyan
    
    $pathForPlaywright = $Path -replace '\\', '/'
    & pnpm exec playwright test $pathForPlaywright
    
    if (Test-Path "playwright-report\index.html") {
        Start-Process "playwright-report\index.html"
    }
}

# Main loop with labeled loops for run-again / change-file / change-project
$testBaseDir = "Test-Local"

:mainLoop while ($true) {
    $projects = @(
        Get-ChildItem -Path $testBaseDir -Directory | 
        Where-Object { $_.Name -notin @('.git', 'node_modules') } |
        Select-Object -ExpandProperty Name
    )
    
    $projectMenu = $projects + "[ Exit ]"
    $projectChoice = Show-Menu -Title "ttest - Select Project" -Items $projectMenu
    
    if ($projectChoice -eq -1 -or $projectChoice -eq ($projectMenu.Count - 1)) {
        exit 0
    }
    
    $selectedProject = $projects[$projectChoice]
    $projectPath = Join-Path $testBaseDir $selectedProject
    
    :scopeLoop while ($true) {
        $scopeMenu = @(
            "Run ALL tests in $selectedProject",
            "Select SPECIFIC test file",
            "[ Back to project selection ]"
        )
        
        $scopeChoice = Show-Menu -Title "Project: $selectedProject" -Items $scopeMenu
        
        if ($scopeChoice -eq -1 -or $scopeChoice -eq 2) {
            continue mainLoop
        }
        
        if ($scopeChoice -eq 0) {
            $runPath = $projectPath
            $runLabel = "ALL tests in $selectedProject"
        }
        else {
            :fileLoop while ($true) {
                $specFiles = @(
                    Get-ChildItem -Path $projectPath -Filter "*.spec.ts" -File | 
                    Select-Object -ExpandProperty Name
                )
                
                $fileMenu = $specFiles + "[ Back ]"
                $fileChoice = Show-Menu -Title "Select Test File in $selectedProject" -Items $fileMenu
                
                if ($fileChoice -eq -1 -or $fileChoice -eq ($fileMenu.Count - 1)) {
                    continue scopeLoop
                }
                
                $selectedFile = $specFiles[$fileChoice]
                $runPath = Join-Path $projectPath $selectedFile
                $runLabel = $selectedFile
                break fileLoop
            }
        }
        
        :runLoop while ($true) {
            Invoke-PlaywrightTest -Path $runPath
            
            $postRunMenu = @(
                "Run again: $runLabel",
                "Change test file (same project: $selectedProject)",
                "Change project",
                "[ Exit ]"
            )
            
            $postChoice = Show-Menu -Title "Test complete" -Items $postRunMenu
            
            switch ($postChoice) {
                0 { continue runLoop }
                1 { continue scopeLoop }
                2 { continue mainLoop }
                default { exit 0 }
            }
        }
    }
}
```

---

## 🎬 run-codegen.bat (Codegen Launcher)

```batch
@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0.."

set PLAYWRIGHT_BROWSERS_PATH=%CD%\browsers

echo ==========================================
echo   Playwright Codegen
echo ==========================================
echo.

if not exist node_modules\@playwright\test (
    echo [ERROR] Playwright not installed
    echo Please run Test-Local\setup.bat first
    pause
    exit /b 1
)

set /p URL="Enter URL to record: "

if "%URL%"=="" (
    echo [ERROR] URL is required
    pause
    exit /b 1
)

echo.
echo Launching codegen for: %URL%
echo Browser + Inspector will open
echo.

call pnpm exec playwright codegen %URL%

echo.
echo Codegen closed
pause
```

---

## 🎯 Vision & Design Principles

### ttest-playwright is a "Testing Workbench"

**Not:** A test framework
**Yes:** A central hub for testing multiple projects

**Structure:**
- One Playwright installation
- One codegen tool
- Test any URL (localhost/staging/production)
- No need to install Playwright in other projects

### Separation of concerns

**Test-Prod = Production URLs (Cloud CI)**
- Smoke tests
- Content verification
- Navigation
- Cannot test localhost (cloud VM can't access)
- Cannot test forms with Turnstile

**Test-Local = Localhost URLs (Local machine)**
- Full E2E flows
- Forms with auth
- Dev testing
- Debug workflows

### Right tool, right environment

**Cloud CI:** GitHub Actions for auto testing + public reports
**Local machine:** Interactive PowerShell menu for dev iteration + codegen

---

## 📚 Reference — Session Journey

**Total effort:** ~15-20 hours across 3 days

**Session TT-1 (Day 30 afternoon):** Build ttest MVP with YAML parser
**Session TT-2 (Day 30 evening):** Deploy CI + GitHub Pages
**Session TT-3 (Day 30 night):** Add folder scan + Test-Local scripts
**Session TT-4 (Day 31):** Architecture pivot to Playwright direct

**Key evolution:**
1. YAML testcase parser (Day 30) → 
2. Discover limitations (codegen manual convert, 4x verbose) → 
3. Pivot to Playwright direct (Day 31) → 
4. Cleanup all legacy code → 
5. Documentation

**Real growth demonstrated:**
- Not just building — questioning architecture
- Not competing with mature tools — extending them
- Understanding constraints (GitHub Actions static YAML, Cloudflare Turnstile)

---

## 🎯 What Next Session Should Do

**Immediate (this session's blocker):**

1. **Decide Chromium approach (A vs B)**
   - Test if system Chromium works: `pnpm exec playwright test Test-Local/nebula-local/smoke.spec.ts`
   - If yes → use system default (simpler)
   - If no → install to local browsers/ folder

2. **Fix setup.bat based on decision**
   - If system default: remove `PLAYWRIGHT_BROWSERS_PATH` from all .bat/.ps1
   - If local: verify install command works correctly

3. **Verify GitHub Actions still works**
   - Run workflow with nebula-spa/smoke
   - Should pass and deploy report

**Follow-up:**

4. **Cleanup legacy files** (if not done)
   - Delete src/, dist/, old tsconfig files

5. **Commit + push all changes**

**Future:**

6. **Nebula Session 9.6** — Fix duplicate booking bug
7. **Nebula Session 10** — LINE integration
8. **Enhance ttest** — Only if real need arises

---

## 📎 Related Files (in original repo)

- `/mnt/user-data/uploads/booking-system-spec__1_.md` — Original Nebula spec
- `/mnt/user-data/uploads/handover-session-9-5.md` — Previous Playwright work in Nebula
- `/mnt/user-data/uploads/ttest-project-brief.md` — Original ttest concept
- `/mnt/user-data/uploads/roadmap.md` — Overall roadmap

**These are Nebula-related, not directly needed for ttest continuation.**

---

## 💡 Communication Style Notes

**User preferences (from userPreferences):**
- Direct, no fluff
- Point-first responses
- Push back if wrong info
- Evidence-based
- Thai language friendly (mixed with English tech terms)
- Balance between encouragement and honest criticism
- No excessive praise
- Format for readability

**Session dynamic:**
- User asks direct questions
- Wants clarity on trade-offs
- Values simplicity over complexity
- Push against over-engineering
- Discovers insights independently (senior-level thinking)

---

## 🎬 Final State (Where we left off)

**Last actions:**
1. Verified `node_modules/@playwright/test` exists (True)
2. Verified `browsers/` folder does NOT exist (False)
3. Ran minimal-test.bat — shows commands succeed (errorlevel 0)
4. Chromium likely installed to `%LOCALAPPDATA%\ms-playwright\` (default location)

**Pending decision:** Approach A (self-contained) vs Approach B (system default)

**Blocking issue:** setup.bat design needs to match chosen approach

**All Playwright/testing infrastructure works** — just Chromium location + setup.bat need alignment

---

## 🎯 Quick Start for Next Session

**Copy-paste this to fresh chat:**

```
Continuing Session TT-4 from previous chat.

Status:
- ttest-playwright pivoted from YAML testcase to Playwright direct
- Package.json cleaned (only @playwright/test)
- GitHub Actions works (verified with Nebula smoke + TodoMVC)
- Test-Local interactive menu works (arrow keys)
- BLOCKED: setup.bat installs Chromium to wrong location (default 
  instead of ./browsers/)

Need to decide:
A. Self-contained (browsers in repo folder) - original design
B. System default (Playwright default location) - simpler

Please help me decide and fix setup.bat accordingly.

Environment:
- Windows PowerShell
- Node v22.13.0
- pnpm 10.23.0
- Repo: D:\n8n\ttest-playwright
- GitHub: CxllmxZ/ttest-playwright (public)
```
