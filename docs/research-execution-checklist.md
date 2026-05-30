# Research Execution Checklist

This checklist is for collecting evidence without deleting existing lint debt.

## Current State

| Component | Existing Debt | New Violations | Gate Result |
| --- | ---: | ---: | --- |
| Backend | 62 lint errors, 0 warnings | 0 | PASS |
| Frontend | 145 lint errors, 20 warnings | 0 | PASS |
| MongoDB preflight | Not measured on real DB yet | NA | FAIL because `MONGODB_URI` is missing |

## Step 1. Configure MongoDB Secret

In GitHub:

1. Open repository `Settings`.
2. Go to `Secrets and variables` -> `Actions`.
3. Select `New repository secret`.
4. Create secret name: `MONGODB_URI`.
5. Paste a connection string for a research/test database, not an uncontrolled production database.

Required secret:

```text
MONGODB_URI
```

## Step 2. Run MongoDB Preflight

Run the GitHub Actions workflow `Progressive Quality Gate`, or run locally:

```bash
MONGODB_URI="mongodb+srv://..." node scripts/mongodb-duplicate-preflight.cjs \
  --collection shortcuts \
  --team-field teamId \
  --url-field url \
  --normalized-url-field normalizedUrl \
  --report reports/mongodb-duplicate-report.json
```

Record these fields:

```text
totalDocumentsScanned
duplicateGroupsFound
duplicateDocumentsFound
indexReadinessStatus
```

For RQ3, useful evidence exists when `duplicateGroupsFound > 0` and `indexReadinessStatus = not_ready`.

## Step 3. Create BEFORE Data

Use this table in the paper before intervention:

| Phase | Backend Errors | Frontend Errors | Frontend Warnings | Duplicate Groups | CI Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Baseline | 62 | 145 | 20 | TBD | TBD |

The lint values are already measured from the generated lint reports and baseline files.

## Step 4. Create AFTER Data

Use this table after enabling the progressive gate and MongoDB preflight:

| Phase | New Violations | Duplicate Groups | CI Result |
| --- | ---: | ---: | --- |
| After | 0 | TBD | PASS when MongoDB preflight is clean |

If duplicates exist, CI should fail. That is still valid evidence: it shows the gate blocks unsafe deployment.

## Step 5. Validate New Lint Violation Blocking

Use a temporary branch:

```bash
git checkout -b codex/test-progressive-lint-gate
```

Add a deliberately unused variable to one changed frontend or backend source file:

```js
const unusedVariable = "test";
```

Commit and push:

```bash
git add .
git commit -m "test: validate progressive lint gate"
git push -u origin codex/test-progressive-lint-gate
```

Expected result:

| Metric | Expected Value |
| --- | --- |
| `newViolations` | 1 or more |
| `lint_gate_status` | failed |
| `ci_status` | failed |

Capture a screenshot of the failed GitHub Actions step and save the JSON lint artifact.

## Step 6. Validate MongoDB Duplicate Detection

Use a test database. Insert two documents with the same logical URL after normalization:

```json
{
  "teamId": "T001",
  "url": "Github.com/Test"
}
```

```json
{
  "teamId": "T001",
  "url": "github.com/test"
}
```

Expected result:

| Metric | Expected Value |
| --- | --- |
| `duplicateGroupsFound` | 1 |
| `indexReadinessStatus` | `not_ready` |
| CI | failed |

Capture the MongoDB preflight log and `reports/mongodb-duplicate-report.json`.

## Step 7. Results Tables

### Table 1. Baseline Quality State

| Metric | Value |
| --- | ---: |
| Backend Lint Errors | 62 |
| Frontend Lint Errors | 145 |
| Frontend Warnings | 20 |

### Table 2. Progressive Gate Validation

| Scenario | Result |
| --- | --- |
| Existing lint debt | Allowed |
| New lint violation | Blocked |
| Duplicate MongoDB records | Detected |
| Unique index unsafe | Blocked |

### Table 3. MongoDB Integrity Check

| Metric | Value |
| --- | ---: |
| Documents scanned | TBD |
| Duplicate groups | TBD |
| Duplicate documents | TBD |

## Step 8. Survey

Create a Google Form now. Target at least 5 team members or 10-15 students.

Use the questions in `docs/student-survey.md`.

## Step 9. Overleaf

Create an Overleaf project named:

```text
PQG-MERN Research
```

Use `paper/main.tex` as the starting file.

