# ttest — Universal Playwright Test Runner

**Project brief + design notes**  
**Status:** Idea/planning phase  
**Timeline:** Side project — เริ่มหลัง Nebula Spa launch

---

## Vision

**Framework ที่แยก test case ออกจาก framework code — เขียน test ครั้งเดียว รันได้ทุกที่**

**Core value proposition:**
> "เวลาเปลี่ยนโปรเจค สิ่งที่ควรเปลี่ยนคือ testcase + config ไม่ใช่ framework source code"

**Target user (tentative):**
- Dev team ที่เขียน Playwright ไม่คล่อง / ไม่อยาก maintain test infrastructure
- QA engineer ที่ไม่ค่อย code (write test ผ่าน YAML)
- Team ที่มี multiple projects + ต้องการ standardize test approach

---

## Problem Statement

### สิ่งที่ Playwright ปกติทำได้ดี
- ✅ Test execution (automated เมื่อ trigger)
- ✅ Cross-browser
- ✅ Auto-wait + retry
- ✅ Debugging tools

### สิ่งที่ยังเป็น pain point
- ❌ **Test authoring ต้องเขียน code** — ทุก test = TypeScript spec.ts
- ❌ **Framework code ผูกกับ project** — reuse ข้าม project ไม่ได้
- ❌ **Non-tech user (QA/BA/PM) เขียน test เองไม่ได้**
- ❌ **Setup ซ้ำ ๆ ทุก project** — playwright.config.ts + fixtures + helpers ทุกครั้ง
- ❌ **Codegen ยัง manual** — ต้องคลิก UI ทีละ step

### สิ่งที่ ttest จะแก้
- Test case = YAML data (ไม่ใช่ code)
- Framework = universal (1 codebase ใช้ทุก project)
- Non-tech user เขียน YAML ได้
- Config file ต่อ project แทน scaffold ซ้ำ
- Codegen wrapper → generate YAML แทน spec.ts

---

## Core Design Principles

### 1. Separation of concerns 3 ระดับ

```
┌──────────────────────────────────────────────┐
│  Layer 1: Framework (ttest package)          │
│  ❌ ไม่เปลี่ยน (universal, npm publish)     │
│                                              │
│  - Runner logic                              │
│  - Built-in actions (goto, click, fill, ...)│
│  - Built-in locators (role, label, css, ...)│
│  - Parser + Executor                         │
│  - Reporter                                  │
└──────────────────────────────────────────────┘
                     ↓ npm install
┌──────────────────────────────────────────────┐
│  Layer 2: Config (ttest.config.yaml)         │
│  ⚠️ เปลี่ยนตามโปรเจค (setup ครั้งเดียว)     │
│                                              │
│  - baseURL                                   │
│  - timeout, retries, workers                 │
│  - env vars                                  │
│  - test directory                            │
│  - locator aliases                           │
│  - hooks                                     │
└──────────────────────────────────────────────┘
                     ↓ read
┌──────────────────────────────────────────────┐
│  Layer 3: Test cases (YAML files)            │
│  ⚠️ เปลี่ยนบ่อยสุด (per feature)             │
│                                              │
│  - tests-yaml/booking/*.yaml                 │
│  - tests-yaml/admin/*.yaml                   │
└──────────────────────────────────────────────┘
```

### 2. Zero project knowledge in framework

Framework ห้ามมี string เฉพาะ project ใน code:
- ❌ `if (project === 'nebula-spa') { ... }`
- ❌ hardcoded URLs, emails, credentials
- ✅ ทุกอย่างมาจาก config หรือ test case

### 3. Config-driven behavior

Same command, different behavior per project:
```powershell
ttest run   # Project A → uses A's config + tests
ttest run   # Project B → uses B's config + tests
```

### 4. Extensibility (project-specific logic)

Project สามารถเพิ่ม custom action / locator / hook ได้โดยไม่แก้ framework:
```
project/
├── ttest.config.yaml
├── tests-yaml/
└── ttest.extensions/       ← project custom code
    ├── verify-in-database.ts
    └── mock-payment-api.ts
```

### 5. Convention over configuration

Sensible defaults — ไม่ต้อง config ทุกอย่าง:
- Default test dir: `./tests-yaml/`
- Default config file: `ttest.config.yaml`
- Default reporter: terminal + html
- Override ผ่าน config หรือ CLI flag

---

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                   ttest (npm package)              │
│  ┌──────────────────────────────────────────────┐ │
│  │  CLI Layer                                    │ │
│  │  - ttest run <file|folder>                   │ │
│  │  - ttest init                                │ │
│  │  - ttest codegen <url>                       │ │
│  │  - ttest watch                               │ │
│  └────────────────┬─────────────────────────────┘ │
│                   │                                │
│  ┌────────────────▼─────────────────────────────┐ │
│  │  Parser (YAML → AST)                         │ │
│  │  - Read YAML files                           │ │
│  │  - Validate schema                           │ │
│  │  - Build test tree                           │ │
│  └────────────────┬─────────────────────────────┘ │
│                   │                                │
│  ┌────────────────▼─────────────────────────────┐ │
│  │  Executor (AST → Playwright calls)           │ │
│  │  - Translate actions                         │ │
│  │  - Translate locators                        │ │
│  │  - Handle assertions                         │ │
│  │  - Load extensions                           │ │
│  └────────────────┬─────────────────────────────┘ │
│                   │                                │
│  ┌────────────────▼─────────────────────────────┐ │
│  │  Playwright Engine                           │ │
│  │  (existing library — reuse, not reinvent)    │ │
│  └────────────────┬─────────────────────────────┘ │
│                   │                                │
│  ┌────────────────▼─────────────────────────────┐ │
│  │  Reporter (terminal / html / json)           │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## Package Structure

```
ttest/                          ← This project (open source repo)
├── src/
│   ├── cli.ts                 ← CLI entry point
│   ├── core/
│   │   ├── runner.ts          ← Orchestrator
│   │   ├── parser.ts          ← YAML → AST
│   │   ├── executor.ts        ← AST → Playwright
│   │   ├── locator-resolver.ts
│   │   ├── config-loader.ts
│   │   └── extension-loader.ts
│   ├── actions/               ← Built-in actions (10 core)
│   │   ├── goto.ts
│   │   ├── click.ts
│   │   ├── fill.ts
│   │   ├── wait.ts
│   │   └── assert.ts
│   ├── locators/              ← Built-in locator strategies
│   │   ├── role.ts
│   │   ├── label.ts
│   │   ├── testid.ts
│   │   ├── text.ts
│   │   └── css.ts
│   └── reporters/
│       ├── terminal.ts
│       ├── html.ts
│       └── json.ts
├── tests/                     ← Tests for ttest itself
├── examples/                  ← Sample YAML for docs
├── docs/
├── package.json
└── README.md
```

---

## Client Project Structure (using ttest)

```
any-project/
├── src/                       ← App code (unchanged)
├── tests-yaml/                ← Test cases
│   ├── smoke/
│   │   └── landing.yaml
│   ├── auth/
│   │   ├── login.yaml
│   │   └── signup.yaml
│   └── main-flow/
│       └── happy-path.yaml
├── ttest.config.yaml          ← Config
├── ttest.extensions/          ← Custom actions (optional)
│   └── custom-action.ts
└── package.json               ← Add: "test": "ttest run"
```

**Usage:**
```powershell
# Install once
pnpm add -D ttest

# Run
pnpm exec ttest run
pnpm exec ttest run tests-yaml/auth/
pnpm exec ttest run --tag=smoke
```

---

## Config Schema Sketch

**`ttest.config.yaml`:**
```yaml
# Basic
baseURL: http://localhost:8787
testDir: ./tests-yaml
timeout: 30000
retries: 2
workers: 1

# Browser
browser: chromium              # chromium | firefox | webkit
headless: true

# Environment variables
env:
  API_KEY: 1x00000000000000000000AA
  TEST_USER: test@example.com

# Locator aliases (reusable across tests)
locators:
  submit_button:
    role: button
    name: "ยืนยัน"
  cancel_button:
    role: button
    name: "ยกเลิก"

# Hooks (lifecycle events)
hooks:
  beforeAll: ./hooks/seed-database.ts
  beforeEach: ./hooks/clear-cookies.ts
  afterEach: ./hooks/capture-logs.ts

# Setup projects (auth, seed, etc)
setup:
  - name: "Login as admin"
    file: ./tests-yaml/_setup/login-admin.yaml
    saveAs: admin-session

# Reporter
reporter:
  - terminal
  - html:
      outputDir: ./ttest-report

# Wait strategy defaults
waitStrategy:
  beforeClick: 100ms
  afterNavigation: waitForLoadState:networkidle
```

---

## Test Case Schema Sketch

**`tests-yaml/booking/customer-flow.yaml`:**
```yaml
# Metadata
name: "Customer จองสำเร็จ end-to-end"
description: "Verify customer สามารถ book service ได้ครบ flow"
tags: [smoke, booking, critical]
timeout: 30000

# Variables (optional)
variables:
  timestamp: "{{now}}"
  test_email: "test-{{random}}@example.com"

# Setup (optional)
setup:
  - action: goto
    target: /

# Test steps
steps:
  - name: "เข้าหน้า booking"
    action: goto
    target: /book
    wait_until: domcontentloaded

  - name: "เลือก service ตัวแรก"
    action: click
    locator:
      role: button
      pattern: /นาที/
      nth: 0

  - name: "รอ calendar โหลด"
    action: wait_for
    locator:
      role: grid

  - name: "เลือกวันแรกที่ว่าง"
    action: click
    locator:
      css: button[aria-label^="วัน"]:not([disabled])
      nth: 0

  - name: "เลือก time slot"
    action: click
    locator:
      role: button
      pattern: /^\d{2}:\d{2}$/
      nth: 0

  - name: "กรอกชื่อ"
    action: fill
    locator:
      label: "ชื่อ"
    value: "Test User"

  - name: "กรอกเบอร์"
    action: fill
    locator:
      label: "เบอร์"
    value: "0891234567"

  - name: "รอ submit button enabled"
    action: wait_for
    locator:
      role: button
      name: "ยืนยันการจอง"
    state: enabled
    timeout: 10000

  - name: "Submit"
    action: click
    locator:
      role: button
      name: "ยืนยันการจอง"

# Assertions
assertions:
  - type: url_matches
    pattern: /book/[a-z0-9]{6}
    message: "Should redirect to booking confirmation"

  - type: text_visible
    value: "Test User"

# Cleanup (optional)
cleanup:
  - action: log
    message: "Test completed"
```

---

## Action Vocabulary (MVP — 10 core)

**Navigation:**
- `goto` — navigate to URL
- `back` — browser back
- `reload` — refresh page

**Interaction:**
- `click` — click element
- `fill` — fill input
- `select` — select dropdown option
- `check` / `uncheck` — checkbox/radio

**Wait:**
- `wait_for` — wait for element/state
- `wait_for_timeout` — fixed delay (last resort)

**Assertion:**
- `assert` — verify condition

**Extended (v1.1):**
- `hover`, `upload`, `download`, `screenshot`, `evaluate_js`, `press` (keyboard)

---

## Locator Strategies (MVP — 5 core)

- `role` — accessible role + name
- `label` — form label
- `testid` — data-testid attribute
- `text` — visible text content
- `css` — CSS selector (last resort)

**Advanced (v1.1):**
- `xpath`, `filter`, `has_text`, `nth`

**Locator can combine:**
```yaml
locator:
  role: button
  name: "จอง"
  exact: true
  nth: 0
```

---

## Assertion Types (MVP — 8 core)

- `visible` — element is visible
- `hidden` — element is hidden
- `text_equals` — exact text match
- `text_contains` — partial text match
- `value_equals` — input value match
- `url_matches` — URL pattern match (regex or exact)
- `count_equals` — element count matches
- `attribute_equals` — attribute value matches

---

## Extension Mechanism

**Project สามารถเพิ่ม custom action ได้โดยไม่แก้ framework**

**`ttest.extensions/verify-database-record.ts`:**
```typescript
import { defineAction } from 'ttest/extensions';
import { execSync } from 'child_process';

export default defineAction({
  name: 'verify-db-record',
  async execute({ params }) {
    const output = execSync(
      `some-db-query --table=${params.table} --id=${params.id}`
    );
    if (!output.toString().includes(params.expectedValue)) {
      throw new Error(`Record ${params.id} not found`);
    }
  },
});
```

**Use in YAML:**
```yaml
- action: verify-db-record
  table: bookings
  id: T3QG9L
  expectedValue: confirmed
```

**Framework auto-loads extensions** from `ttest.extensions/` folder — no framework modification needed.

---

## Hooks / Lifecycle Events

**`ttest.config.yaml`:**
```yaml
hooks:
  beforeAll: ./hooks/global-setup.ts
  beforeEach: ./hooks/reset-state.ts
  afterEach: ./hooks/capture-artifacts.ts
  afterAll: ./hooks/cleanup.ts
```

**Hook file:**
```typescript
export default async function() {
  // Framework calls this at lifecycle event
  // Project decides what happens
}
```

**Common uses:**
- Seed database before tests
- Reset auth state between tests
- Capture logs on failure
- Notify Slack after suite

---

## CLI Commands

```powershell
# Run tests
ttest run                              # Run all tests
ttest run booking/                     # Run folder
ttest run booking/happy-path.yaml      # Run single file
ttest run --tag=smoke                  # Filter by tag
ttest run --tag=critical,booking       # Multiple tags (AND)
ttest run --grep="login"               # Filter by name

# Development
ttest watch                            # Auto-rerun on file change
ttest run --headed                     # Show browser
ttest run --debug                      # Interactive debug mode

# Tooling
ttest init                             # Scaffold new project
ttest codegen <url>                    # Generate YAML from browser recording
ttest report                           # Open last HTML report
ttest validate                         # Validate YAML syntax without running

# Info
ttest list                             # List all discovered tests
ttest list --tags                      # Show all tags used
```

---

## What Changes / What Doesn't (Key Insight)

### Framework (ttest package) — ไม่เปลี่ยน

Same across all projects:
- `package.json` deps: `"ttest": "^1.0.0"`
- Actions vocabulary
- Locator strategies
- CLI commands
- Runner behavior

### Config — เปลี่ยนตาม project (setup ครั้งเดียว)

Different per project:
- `baseURL`
- `env` vars
- `testDir` path
- `locators` aliases
- `hooks` paths

### Test cases — เปลี่ยนตลอด (add per feature)

Different per project + growing:
- `.yaml` files in test directory
- Steps + assertions
- Metadata (tags, description)

### Extensions — เปลี่ยนตาม project (optional)

Different per project (ถ้ามี):
- Custom actions
- Custom locators
- Custom reporters

---

## Comparison with Existing Tools

| Tool | Approach | Strength | Weakness (for our use case) |
|---|---|---|---|
| **Playwright vanilla** | Code (TypeScript) | Full control, mature | Code required, no reuse across projects |
| **Cucumber + Playwright** | Gherkin BDD | Business-readable | Needs glue code, wordy syntax |
| **Robot Framework** | Tabular DSL | Mature, keyword-driven | Selenium-based (slower), Python ecosystem |
| **Katalon Studio** | GUI + code | Enterprise features | Proprietary, expensive, heavy |
| **Testim / Testsigma** | AI + codeless | Non-tech friendly | SaaS lock-in, expensive |
| **playwright-bdd** (npm) | Gherkin + Playwright | Modern BDD | Still needs glue TypeScript |
| **ttest (this idea)** | YAML native + Playwright | Simple, portable, git-friendly | Not built yet, unproven |

**Differentiation:**
- YAML native (simpler than Gherkin, no glue code needed)
- Playwright-based (modern, fast)
- Git-first (test cases = version-controlled data)
- Extensible per project (custom actions)
- Free + open source

---

## MVP Scope

### Phase 1: Core MVP (~30 hours)

**Goal:** ttest ทำงานได้กับ 1 real project (Nebula Spa เป็น first user)

Deliverables:
- [ ] YAML parser (with schema validation)
- [ ] 10 built-in actions
- [ ] 5 built-in locator strategies
- [ ] 8 assertion types
- [ ] Config loader
- [ ] Terminal reporter
- [ ] CLI: `ttest run <file|folder>`
- [ ] Test against Nebula Spa (convert 8 existing tests → YAML)

### Phase 2: Extensibility (~20 hours)

**Goal:** Support custom logic per project

Deliverables:
- [ ] Extension API (custom actions)
- [ ] Custom locator strategies
- [ ] Hooks (beforeAll, afterEach, ...)
- [ ] Locator aliases
- [ ] Variables + templates (`{{now}}`, `{{random}}`)
- [ ] Test against 2nd project (validate universality)

### Phase 3: Developer Experience (~30 hours)

**Goal:** ใช้งานง่าย + debug ดี

Deliverables:
- [ ] HTML reporter (rich UI with screenshots + trace)
- [ ] Codegen wrapper (`ttest codegen`)
- [ ] Project scaffold (`ttest init`)
- [ ] Watch mode (`ttest watch`)
- [ ] VSCode extension (YAML syntax + snippets)
- [ ] Rich error messages (suggest fixes)

### Phase 4: Community + Publish (~10 hours)

**Goal:** Ship + gather feedback

Deliverables:
- [ ] npm publish (`ttest` package)
- [ ] Documentation site
- [ ] Example gallery
- [ ] GitHub Actions template
- [ ] Blog post + Threads announcement

**Total MVP → shippable: ~90 hours**  
**Realistic timeline:** Weekend project across 4-6 months

---

## Business Considerations

### Distribution model

**Option A: Free / open source**
- npm publish + MIT license
- Community adoption first
- Portfolio value for creator
- Reputation → speaking opportunities
- Potential contributors

**Option B: Freemium**
- Free CLI + core features
- Paid: Cloud dashboard, team collab, priority support
- Similar to Playwright itself + Playwright Cloud

**Option C: Consulting / custom**
- Build ttest → use in consulting projects
- Custom implementations for enterprise clients
- Training / workshops

**Recommendation:** Start with A (open source) → validate demand → decide on monetization later

### Positioning

**Target audience priority:**
1. Solo dev / small team = quick automation without ceremony
2. QA + Dev teams = collaborative test authoring
3. Enterprise = evaluate against Katalon/Testim (later)

**Marketing angles:**
- "Playwright for humans" (readable test cases)
- "Test cases = data, not code" (git-friendly)
- "One framework, all projects" (universal)
- Thai-first documentation (SEA market gap)

### Success metrics (Phase 1-2)

- 100 npm downloads/week within 3 months
- 5+ real projects using it (not counting your own)
- 10+ GitHub stars
- 1-2 community contributors

If reached → invest in Phase 3-4  
If not → learning experience, no sunk cost anxiety

---

## Open Questions to Decide

### Before starting Phase 1

**1. Scope of MVP actions**
- 10 minimum vs 20 comprehensive?
- Include screenshot comparison (visual regression)?
- Include file upload?

**2. YAML vs alternative format**
- Pure YAML?
- YAML + JSON schema for validation?
- Support both YAML + JSON?
- Consider TOML?

**3. Async execution model**
- Sequential steps only?
- Parallel steps within test?
- Fork-join workflows?

**4. Error handling philosophy**
- Fail-fast (stop on first error)?
- Continue-on-error (collect all failures)?
- Configurable per test?

**5. Variables + templating**
- Simple `{{var}}` replacement?
- Full templating engine (Handlebars/Nunjucks)?
- JavaScript expressions?

**6. Node.js requirement**
- Minimum Node version?
- Support Bun / Deno?
- Distribute as standalone binary?

### Before Phase 2 (extensibility)

**7. Extension loading strategy**
- Auto-discover from folder?
- Explicit registration in config?
- Plugin system (like Vite plugins)?

**8. Type safety for extensions**
- Provide TypeScript types?
- Support both TS + JS extensions?

**9. Cross-project extension sharing**
- npm packages for common extensions?
- Registry for community extensions?

### Before Phase 3 (DX)

**10. IDE integration priority**
- VSCode extension first?
- IntelliJ / WebStorm support?
- LSP (Language Server Protocol) for universal support?

**11. Reporter formats**
- Terminal + HTML only?
- JUnit XML (for CI integration)?
- Allure reporter?
- Custom reporter API?

**12. Debugging support**
- Playwright trace viewer integration?
- Chrome DevTools protocol exposure?
- Step-by-step debugger?

---

## Real Challenges to Anticipate

### Challenge 1: Locator abstraction ไม่ perfect

**Problem:** UI patterns ต่างกันมากใน projects — role-based ใน 1 project อาจใช้ testid ใน project อื่น

**Solution:** Flexible locator with fallback chain:
```yaml
locator:
  primary:
    role: button
    name: "Submit"
  fallback:
    testid: submit-btn
```

### Challenge 2: Complex flow ไม่ fit YAML

**Problem:** Loop, condition, dynamic decision ใน test = ยากใน declarative YAML

**Solution:** Escape hatch — custom action ผ่าน extension:
```yaml
- action: run-script
  file: ./scripts/complex-logic.ts
```

**Trade-off:** Accept ว่า YAML cover 80% test cases, 20% ต้องใช้ code

### Challenge 3: Debugging YAML

**Problem:** YAML error ไม่มี stack trace เหมือน TypeScript

**Solution:** Rich error reporter with:
- Exact YAML line number
- Screenshot at failure point
- Suggested fixes
- Link to trace viewer

**Example:**
```
❌ tests-yaml/booking/customer-flow.yaml:42
   Step: "click submit button"
   Action: click
   Locator: role=button name="ยืนยันการจอง"
   
   Error: Locator resolved to 2 elements
   
   Suggestion: Try adding
     exact: true
   or
     nth: 0
   
   Screenshot: .ttest/report/step-6.png
```

### Challenge 4: Version compatibility

**Problem:** ttest v2 changes YAML schema → existing tests break

**Solution:**
- Semver strict
- Migration tool (`ttest migrate v1 v2`)
- Support 2 major versions in parallel

### Challenge 5: Playwright API changes

**Problem:** Playwright updates → ttest ต้อง sync

**Solution:**
- Pin Playwright version in ttest
- Abstract Playwright calls through internal API
- Test compat before bumping Playwright dep

---

## Validation Plan

**Before investing 90 hours:**

### Step 1: Prototype (~5 hours)
- Minimal parser (support goto, click, fill only)
- Minimal executor (Playwright wrapper)
- Convert 1 Nebula Spa test → YAML
- Run + verify pass

**If pass:** Concept works → proceed  
**If fail:** Re-evaluate approach

### Step 2: Feedback loop (~10 hours)
- Show prototype to 3-5 dev friends
- Ask: "Would you use this over Playwright vanilla? Why/why not?"
- Iterate based on feedback

### Step 3: Real project trial (~15 hours)
- Convert Nebula Spa fully (all 8 tests → YAML)
- Use for 1 month → note pain points
- Fix top 3 pain points

### Step 4: External validation (~10 hours)
- Post on Threads/GitHub: "I'm building this — interested?"
- If 10+ reactions/stars → build Phase 2
- If crickets → learning experience, park project

---

## Reference — Prior Discussions

### Chat: Session 9.5 Playwright Setup (Nebula Spa)

**Context:** ระหว่างทำ Playwright E2E สำหรับ Nebula Spa เกิดการ discussion ที่นำไปสู่ ttest idea:

1. **Excel-driven idea** — เริ่มด้วยไอเดียใช้ Excel เป็น test authoring interface
2. **Realized Excel unnecessary** — Storage format = YAML/JSON/Markdown ก็ทำได้เหมือน Excel
3. **Codegen paradox** — Codegen ช่วย write test แต่ process ยัง manual → เกิดคำถาม "automated ยังไงกันแน่"
4. **Clarification** — Test authoring vs Test execution vs Test triggering เป็น 3 concept แยกกัน
5. **Priority framework:**
   - Test Execution ✅ (Playwright)
   - Test Trigger 🎯 (GitHub Actions — next in Nebula Spa)
   - Test Authoring ⏸ (ttest project = long-term exploration)
6. **Universal framework insight** — Framework code ไม่เปลี่ยน, Config + Tests เปลี่ยนตาม project

### Key learnings applicable to ttest

**Bugs encountered while setting up Nebula Spa Playwright (12 total):**
- Locator strict mode violations
- Timing/race conditions
- State pollution across test runs
- Env var precedence (build-time inlining)
- Parallel workers vs DB write locks

**Implication for ttest:** Framework ต้องช่วยแก้ pain points เหล่านี้ให้ user ไม่เจอเอง:
- Better default wait strategies
- Clear idempotency guidance
- Config validation with helpful errors
- Sensible parallel defaults

---

## Next Steps (When Ready to Start)

**Prerequisites:**
- [ ] Nebula Spa launched (Session 10 LINE + polish complete)
- [ ] 10-20 hours available per week for side project
- [ ] Weekend energy for solo project work

**First session goals:**
1. Setup new repo: `ttest`
2. Initial `package.json` + TypeScript config
3. Prototype: parser + executor for `goto` + `click` only
4. Convert 1 Nebula Spa test → YAML → run → verify

**Ask AI at that time:**
```
เริ่ม ttest project — universal Playwright test runner

Reference: ttest-project-brief.md
Goal: Phase 1 MVP prototype

Start with:
1. Setup repo + tsconfig
2. Parser for basic YAML schema
3. Executor: goto + click actions
4. Test against 1 real YAML

พร้อมเริ่ม
```

---

## Alternative Paths to Consider

### Path A: Build ttest as designed
- Follow this brief
- ~90 hours over 4-6 months
- Own product, full control

### Path B: Contribute to existing tool
- Fork `playwright-bdd` and add YAML support
- Faster time to value
- Less ownership

### Path C: Wrapper only (thinner scope)
- ttest = CLI wrapper around playwright-bdd
- Focus on YAML + config UX only
- ~30 hours total

### Path D: AI-first approach
- Skip YAML — use natural language
- LLM (Claude/GPT) generates Playwright code from intent
- Cutting edge but non-deterministic

**Recommendation:** Path A (own product) if goal = portfolio + learning + potential business  
Path B (contribute) if goal = practical helper without ownership burden

---

## Final Notes

### Why this idea matters (personal motivation)

1. **Skill development** — building a dev tool = deep understanding of software design, DX, distribution
2. **Portfolio** — "Author of X (Y downloads)" = strong signal to employers/clients
3. **Market gap** — real need for QA-friendly Playwright authoring (SEA market especially)
4. **Reusable across career** — this tool = personal productivity asset for all future projects
5. **Community impact** — help other devs/QA move from Selenium era to modern testing

### Why this idea might fail (honest assessment)

1. **Cucumber + Playwright** already covers similar space
2. **YAML fatigue** — devs may prefer TypeScript over YAML for logic
3. **Learning curve** — new DSL to learn vs "just write Playwright"
4. **Maintenance burden** — solo maintainer = risky for adopters
5. **AI disruption** — LLM tools may make declarative test format obsolete faster than expected

### Verdict for now

**Park this idea. Focus on Nebula Spa launch first.**

Return to ttest after:
- Nebula Spa sold on Fastwork
- 20+ hours/week available
- Fresh perspective from 2-4 weeks break

**No urgency — good ideas don't spoil.**

---

## CI Infrastructure Considerations (Design-time thinking)

**From Q&A about GitHub Actions during Session 9.5 chat — apply to ttest architecture**

### Why ttest needs to think about CI early

Users จะรัน ttest ผ่าน GitHub Actions (หรือ CI อื่น) — architecture ต้อง CI-friendly ตั้งแต่ต้น

**Key insights that apply to ttest design:**

### 1. Runner = ephemeral VM

**Implication for ttest:**
- ห้าม assume state persists ระหว่าง runs
- Install ttest globally ไม่ได้ประโยชน์ — ต้อง install ทุก run
- **Solution:** Ship as npm package → fast install via cache

### 2. Cache is critical

**Implication:**
- ttest binary + Playwright browsers = ต้อง cache
- Suggest cache pattern ใน docs:
  ```yaml
  - uses: actions/cache@v4
    with:
      path: |
        node_modules
        ~/.cache/ms-playwright
      key: ${{ hashFiles('package-lock.json') }}
  ```

### 3. Concurrency multi-user

**Scenario:** Team ใช้ ttest แล้ว 10 devs push พร้อมกัน
- Each dev = separate runner (parallel OK)
- Cache = shared per repo
- **ttest ต้องไม่มี race condition** — ห้าม write shared file

**Design implication:**
- Test results = per-run output (not shared file)
- Report = per-run folder with unique ID
- Logs = ไม่ append shared file

### 4. Scale bottlenecks to avoid

**GitHub Free tier limits ที่ user จะเจอ:**
- 2,000 min/month
- 20 concurrent jobs
- 10 GB cache per repo

**ttest ต้อง optimize เพื่อไม่ให้ user โดน limit:**
- **Fast startup:** parse YAML < 100ms
- **Cache-friendly:** ไม่ regenerate assets ที่ cache ได้
- **Parallel-safe:** support `workers > 1` โดยไม่ conflict
- **Minimal deps:** small install size (target < 50 MB)

### 5. Rate limits — external dependencies

**Playwright browsers download:**
- Cache aggressively (suggest ใน docs)
- Consider bundling common browsers option

**Registry (npm) rate limits:**
- Minimize dependencies (fewer packages = faster install)
- Peer deps for Playwright (user จัดการเอง)

---

## CI-Aware ttest Features

**Features ที่ควรมีเพื่อ CI use case:**

### 1. `ttest run --shard=1/4`
Split test suite across parallel jobs:
```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: ttest run --shard=${{ matrix.shard }}/4
```

### 2. JUnit XML reporter (for CI integration)
```yaml
reporter:
  - terminal
  - junit:
      output: ./test-results/junit.xml
```

Auto-integrate with GitHub Actions test reporting.

### 3. GitHub Actions template
```yaml
# .github/workflows/e2e.yml (ttest scaffold)
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/cache@v4
        with:
          path: |
            node_modules
            ~/.cache/ms-playwright
          key: ${{ hashFiles('package-lock.json') }}
      - run: npm ci
      - run: npx playwright install chromium
      - run: npx ttest run
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: ttest-report
          path: .ttest/report/
```

Generated by `ttest init --ci` command.

### 4. Retry-only-failed mode
```powershell
ttest run --retry-failed
```

Re-run only tests that failed in previous run — save minutes on flaky tests.

### 5. Test result caching
Store hash of test file + source → skip if unchanged
```powershell
ttest run --cache-tests
```

Save time when only some tests changed.

### 6. Cost-aware defaults

**Documentation should teach:**
- "Enable cache to save 60-80% CI time"
- "Use `cancel-in-progress` for PRs"
- "Split heavy tests to nightly cron"

Ship as best practices, not hidden knobs.

---

## Public Repo Strategy

**Key insight from Q&A:** Public GitHub repo = ฟรี unlimited Actions

**Implication for ttest:**
- If ttest itself is public → contributors get free CI
- If users' projects are public → free CI for their tests
- **Marketing angle:** "Free CI-friendly test framework" (positioned against paid options like Katalon)

**ttest own CI:**
- Open source
- Every PR runs full test suite (free!)
- Nightly cross-browser matrix
- Community can contribute without infra cost

---

## Roadmap Update — CI as first-class concern

**Original Phase 3 (DX):** HTML reporter, codegen, watch mode  
**Updated Phase 3:** + CI templates + Sharding + Cache guides

**New Phase 3 deliverables:**
- [ ] HTML reporter
- [ ] Codegen wrapper
- [ ] Scaffold (`ttest init`)
- [ ] Watch mode
- [ ] VSCode extension
- [ ] **`ttest init --ci` — generate GitHub Actions workflow**
- [ ] **Sharding support (`--shard=N/M`)**
- [ ] **JUnit XML reporter**
- [ ] **Best practices docs for CI optimization**

**Rationale:** Real ttest users จะรันบน CI ตั้งแต่วันแรก — ถ้าไม่มี support = pain

---

## Document Metadata

**Created:** 30 สิงหาคม 2026 (Day 30 of Nebula Spa journey)  
**Author:** Nopparut + Claude discussion  
**Status:** Idea validated, awaiting execution  
**Reference chat:** Session 9.5 Playwright E2E Setup + GitHub Actions Q&A  
**Related project:** Nebula Spa (first potential user)

**Update log:**
- v1.0 (2026-08-30): Initial brief captured from discussion
- v1.1 (2026-08-30): Added CI infrastructure considerations + scale thinking from Q&A about GitHub Actions
