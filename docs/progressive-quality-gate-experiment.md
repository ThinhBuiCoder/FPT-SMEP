# Progressive CI/CD Quality Gate Experiment

## 1. Detailed Experiment Design

### Research Objective

This empirical case study evaluates whether a progressive CI/CD quality gate can improve deployability and data-integrity readiness in a student MERN web project while avoiding immediate disruption from pre-existing technical debt. The intervention is not intended to prove broad causal generalization; it examines whether new-code-only lint enforcement and MongoDB duplicate preflight checks are feasible and useful under legacy lint debt conditions.

### Research Questions Mapping

| ID | Research Question | Evaluation Focus | Primary Measures |
| --- | --- | --- | --- |
| RQ1 | To what extent does a progressive lint gate reduce CI failures caused by legacy lint debt? | CI stability before and after new-code-only lint enforcement | CI pass/fail status, lint-related CI failures, new lint violations |
| RQ2 | Can duplicate MongoDB records be detected before deployment using a preflight quality gate? | Data-integrity defect detection before deployment | Duplicate groups detected, duplicate documents detected, preflight status |
| RQ3 | Does the approach improve readiness for a unique compound MongoDB index? | Whether `{ teamId, normalizedUrl }` can be safely enforced | Unique index readiness result, duplicate groups found |
| RQ4 | How does progressive enforcement affect student development productivity and perception? | Friction, fix time, and perceived usefulness | Average issue resolution time, deployment result, student survey score |

### Variables

| Type | Variables |
| --- | --- |
| Independent variables | Quality gate strategy: baseline CI without progressive gating vs. progressive CI with new-code-only lint gating and MongoDB preflight checks; phase: before vs. after intervention |
| Dependent variables | CI status, lint-related CI failures, new lint violations, duplicate groups found, duplicate documents found, index readiness status, deployment status, issue resolution time, student survey score |
| Controlled variables | Same student project, same repository, same ESLint rule set during each phase, same MongoDB collection and uniqueness rule, same CI provider, same branch policy, same measurement window length where possible, same development team |

### Experimental Phases

| Phase | Description | Expected Evidence |
| --- | --- | --- |
| Baseline | Observe the project using existing CI behavior. Legacy lint debt may fail CI, and MongoDB duplicate records are not checked before deployment. | Baseline lint counts, CI failures, deployment outcomes, manually observed duplicate issues |
| Intervention | Enable progressive lint gates and MongoDB preflight checks. Existing lint debt is tolerated through a committed baseline, but new lint findings fail CI. Duplicate records and index readiness are checked before deployment. | JSON lint reports, MongoDB duplicate report, CI outcome, issue resolution time |
| Comparison | Compare before/after measurements over equivalent development intervals or equivalent numbers of CI runs. | Before/after result tables and descriptive statistics |

### Baseline Phase

The baseline phase records the state of the project before the progressive gate is introduced. Existing lint debt is measured but not separated from newly introduced issues. CI may fail due to old lint violations, and duplicate MongoDB records may remain undetected until runtime or deployment. No automated check verifies whether a unique compound index on `{ teamId, normalizedUrl }` can be safely created.

### Intervention Phase

The intervention introduces three controls:

1. A progressive lint gate for backend and frontend code.
2. A MongoDB duplicate detection preflight for the compound rule `{ teamId, normalizedUrl }`.
3. A unique-index readiness decision derived from duplicate detection.

Legacy lint violations are stored in baseline JSON files under `quality-gates/baselines/`. During CI, current ESLint findings are converted into fingerprints and compared with the baseline. Only findings absent from the baseline, scoped to changed files when Git history permits, fail the pipeline.

### Data Collection Process

Data should be collected from each CI run and each deployment attempt. GitHub Actions artifacts provide JSON reports for lint and MongoDB checks. Git metadata provides branch, commit hash, and run date. Issue resolution time can be measured from the timestamp of a failing CI run to the timestamp of the first succeeding run or merged fix. Student perception can be collected through a short post-intervention Likert survey.

### Measurement Process

For each run, extract the lint totals and new violation counts from `reports/backend-lint-report.json` and `reports/frontend-lint-report.json`. Extract duplicate and index-readiness measurements from `reports/mongodb-duplicate-report.json`. Record CI and deployment outcomes from GitHub Actions. For fix time, use the elapsed time between the first failed run for a gate violation and the successful run that resolves it.

### Expected Outputs

Expected research outputs include a run-level dataset, baseline and intervention summary tables, lint JSON reports, MongoDB duplicate reports, deployment outcomes, and a student perception table. Expected engineering outputs include a reproducible GitHub Actions workflow, committed baseline files, preflight scripts, and CI artifacts.

### Threats to Validity

Construct validity may be affected if lint violations are used as a proxy for code quality, since lint counts do not fully represent maintainability or correctness. Internal validity is limited because other project changes may influence CI stability and deployment success. External validity is limited by the single student-project context and the chosen MERN stack. Conclusion validity is limited by sample size and the number of CI runs. Reliability threats include inconsistent developer behavior, changes to dependencies, and variation in MongoDB dataset state during the study.

## 2. Metrics Definition

| Metric Name | Description | Source of Data | Measurement Method | Relevance |
| --- | --- | --- | --- | --- |
| Total lint errors | Number of ESLint findings with error severity | Lint JSON reports | Count severity `2` findings across backend and frontend | RQ1 |
| Total lint warnings | Number of ESLint findings with warning severity | Lint JSON reports | Count severity `1` findings across backend and frontend | RQ1 |
| New lint violations | Current findings absent from the baseline | Progressive lint reports | Count `newFindings` from reports | RQ1, RQ4 |
| CI pass/fail status | Final status of the CI run | GitHub Actions | Record workflow conclusion | RQ1, RQ4 |
| Lint-related CI failures | CI failures caused by lint gates | GitHub Actions and lint reports | Mark failure when lint gate step fails | RQ1 |
| Duplicate MongoDB groups detected | Number of duplicate `{ teamId, normalizedUrl }` groups | MongoDB duplicate report | Count `duplicateGroupsFound` | RQ2, RQ3 |
| Number of duplicate documents | Number of documents participating in duplicate groups | MongoDB duplicate report | Count `duplicateDocumentsFound` | RQ2, RQ3 |
| Unique index readiness result | Whether the unique index can be safely created | MongoDB duplicate report | `ready` when no duplicates or invalid URLs exist | RQ3 |
| Deployment result | Whether deployment succeeded after CI | Deployment logs | Record deployment status | RQ4 |
| Average issue resolution time | Mean time to resolve gate failures | CI timestamps and commits | Time from first failed gate run to succeeding run | RQ4 |
| Student survey score | Student perception of usefulness and friction | Survey form | Mean Likert score per item and overall | RQ4 |

## 3. MongoDB Duplicate Detection Script

The script is implemented at `scripts/mongodb-duplicate-preflight.cjs`. It uses Mongoose, reads `MONGODB_URI`, scans the target collection, computes `normalizedUrl` from `url` when necessary, groups records by `{ teamId, normalizedUrl }`, writes `reports/mongodb-duplicate-report.json`, and exits with code `1` when duplicates or invalid URLs are found.

Example command:

```bash
node scripts/mongodb-duplicate-preflight.cjs \
  --collection shortcuts \
  --team-field teamId \
  --url-field url \
  --normalized-url-field normalizedUrl \
  --report reports/mongodb-duplicate-report.json
```

The machine-readable report includes `duplicateGroupsFound`, `duplicateDocumentsFound`, `indexReadinessStatus`, and the duplicate document IDs for CI diagnostics.

## 4. ESLint Progressive Quality Gate

The progressive lint gate is implemented at `scripts/progressive-lint-gate.cjs`. It runs ESLint in either `backend` or `frontend`, generates a JSON report, fingerprints each finding by file, rule, line, column, and message, then compares the current findings with a baseline file.

Backend report:

```bash
node scripts/progressive-lint-gate.cjs \
  --project backend \
  --target . \
  --report reports/backend-lint-report.json \
  --baseline quality-gates/baselines/backend-lint-baseline.json
```

Frontend report:

```bash
node scripts/progressive-lint-gate.cjs \
  --project frontend \
  --target . \
  --report reports/frontend-lint-report.json \
  --baseline quality-gates/baselines/frontend-lint-baseline.json
```

Baseline files are stored at:

```text
quality-gates/baselines/backend-lint-baseline.json
quality-gates/baselines/frontend-lint-baseline.json
```

Initial baseline example:

```json
{
  "generatedAt": null,
  "description": "Initial frontend lint debt baseline.",
  "findings": []
}
```

To create a real baseline after a baseline measurement run:

```bash
node scripts/generate-lint-baseline.cjs reports/frontend-lint-report.json quality-gates/baselines/frontend-lint-baseline.json
node scripts/generate-lint-baseline.cjs reports/backend-lint-report.json quality-gates/baselines/backend-lint-baseline.json
```

The gate exits with code `1` only when findings are not present in the baseline. When Git history is available, the gate scopes comparison to changed files. This allows legacy debt to remain temporarily tolerated while preventing newly introduced violations.

## 5. GitHub Actions Workflow

The workflow is implemented at `.github/workflows/progressive-quality-gate.yml`. It checks out the repository, installs backend and frontend dependencies, runs backend and frontend progressive lint gates, runs tests when available, executes the MongoDB duplicate and index-readiness preflight, uploads all JSON reports as artifacts, and fails the pipeline when any gate fails.

The workflow requires `MONGODB_URI` to be configured as a GitHub Actions secret.

## 6. Unique Index Readiness Check

The index readiness check is performed by the MongoDB preflight script. The index is considered ready only when no duplicate groups are found for the compound key `{ teamId, normalizedUrl }` and no invalid URLs prevent normalization.

Optional index creation after cleanup:

```bash
node scripts/mongodb-duplicate-preflight.cjs --create-index
```

MongoDB unique index creation fails when duplicate data already exists because the database must guarantee that every existing and future document satisfies the unique constraint. If two or more documents already share the same compound key, MongoDB cannot build the unique index without violating that constraint.

## 7. Dataset Output for Research Paper

Recommended CSV schema:

```csv
run_id,date,branch,commit_hash,phase,total_lint_errors,total_lint_warnings,new_lint_violations,ci_status,lint_gate_status,duplicate_groups_found,duplicate_documents_found,index_readiness_status,deployment_status,fix_time_minutes,notes
```

Example dataset:

| run_id | date | branch | commit_hash | phase | total_lint_errors | total_lint_warnings | new_lint_violations | ci_status | lint_gate_status | duplicate_groups_found | duplicate_documents_found | index_readiness_status | deployment_status | fix_time_minutes | notes |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- | --- | ---: | --- |
| R001 | 2026-05-01 | develop | a1b2c3d | baseline | 84 | 17 | NA | failed | not_applied | NA | NA | not_checked | not_deployed | NA | Legacy lint failure blocked CI |
| R002 | 2026-05-04 | develop | b2c3d4e | baseline | 82 | 16 | NA | passed | not_applied | NA | NA | not_checked | deployed | NA | Lint step skipped to deploy |
| R003 | 2026-05-10 | feature/shortcut | c3d4e5f | intervention | 82 | 16 | 2 | failed | failed | 0 | 0 | ready | not_deployed | 42 | New frontend lint findings |
| R004 | 2026-05-12 | feature/shortcut | d4e5f6g | intervention | 82 | 16 | 0 | failed | passed | 3 | 7 | not_ready | not_deployed | 75 | Duplicate shortcuts detected |
| R005 | 2026-05-13 | develop | e5f6g7h | intervention | 81 | 15 | 0 | passed | passed | 0 | 0 | ready | deployed | 0 | Cleanup completed |

## 8. Result Tables for the Paper

### Table 1. Experiment Phases

| Phase | Quality Gate Condition | Data Collected | Expected Interpretation |
| --- | --- | --- | --- |
| Baseline | Legacy lint debt exists; no duplicate preflight | CI status, lint totals, deployment result | Establish pre-intervention instability and debt level |
| Intervention | Legacy debt tolerated; new lint and duplicates fail CI | Lint reports, duplicate reports, index readiness, deployment result | Evaluate progressive enforcement feasibility |
| Comparison | Before/after descriptive analysis | Aggregated metrics by phase | Assess balance between quality enforcement and productivity |

### Table 2. Metrics Definition

| Metric | Unit | Source | RQ |
| --- | --- | --- | --- |
| Total lint errors | Count | ESLint JSON | RQ1 |
| New lint violations | Count | Progressive lint report | RQ1 |
| Lint-related CI failures | Count | GitHub Actions | RQ1 |
| Duplicate groups detected | Count | MongoDB preflight report | RQ2 |
| Duplicate documents found | Count | MongoDB preflight report | RQ2 |
| Index readiness result | Categorical | MongoDB preflight report | RQ3 |
| Fix time | Minutes | CI timestamps | RQ4 |
| Survey score | Likert mean | Student survey | RQ4 |

### Table 3. Before/After CI Results

| Phase | CI Runs | Passed | Failed | Lint-Related Failures | Mean New Lint Violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline |  |  |  |  | NA |
| Intervention |  |  |  |  |  |

### Table 4. MongoDB Duplicate Detection Results

| Run | Phase | Duplicate Groups | Duplicate Documents | Index Readiness | Deployment Result |
| --- | --- | ---: | ---: | --- | --- |
|  |  |  |  |  |  |

### Table 5. Student Perception Survey Results

| Survey Item | Construct | Scale | Mean | SD |
| --- | --- | --- | ---: | ---: |
| The gate helped me identify new issues earlier. | Perceived usefulness | 1-5 |  |  |
| The gate reduced confusion caused by legacy lint errors. | Clarity | 1-5 |  |  |
| The gate added acceptable overhead to development. | Perceived effort | 1-5 |  |  |
| The duplicate check improved confidence before deployment. | Deployment confidence | 1-5 |  |  |
| Overall, the approach was useful for the project. | Overall acceptance | 1-5 |  |  |

## 9. Research Writing Support

### Experiment Design

This study was designed as a before/after empirical case study of a student MERN web project. The baseline phase observed the project under existing CI conditions, where historical lint violations and potential MongoDB duplicate records were not separated from newly introduced issues. The intervention phase introduced a progressive quality gate that tolerated known lint debt through baseline files while failing CI for newly observed lint findings. The same intervention added a MongoDB preflight check to detect duplicate records under the compound uniqueness rule `{ teamId, normalizedUrl }` before deployment.

The purpose of the design was to evaluate whether progressive quality enforcement can support incremental quality improvement without requiring students to remove all historical debt before continuing development. The unit of analysis was the CI run, supplemented by deployment outcomes and student perception data.

### Implementation of Progressive Quality Gate

The progressive quality gate consists of two automated controls. First, backend and frontend ESLint outputs are generated in JSON format and compared against committed baseline files. Each lint finding is represented as a fingerprint derived from its file path, rule identifier, source location, and message. Findings already present in the baseline are treated as legacy debt, while findings absent from the baseline are classified as new violations and fail the CI run.

Second, a MongoDB preflight script scans the target collection using Mongoose and groups documents by the compound key `{ teamId, normalizedUrl }`. If a stored `normalizedUrl` is unavailable, the script computes it from the raw `url` field using the same normalization logic used by the application. Duplicate groups or invalid URLs cause the preflight to fail and produce a machine-readable report. The same result is used to determine whether the unique compound index can be safely created.

### Data Collection

Data were collected from GitHub Actions workflow executions, JSON artifacts, Git metadata, deployment records, and student survey responses. Each CI run produced backend lint, frontend lint, and MongoDB duplicate reports. The run-level dataset recorded the branch, commit hash, experimental phase, lint totals, new violations, CI status, duplicate counts, index readiness status, deployment result, and issue resolution time. Student perception was measured after the intervention using a short Likert-scale survey.

### Metrics

The study used descriptive metrics aligned with the research questions. Lint metrics measured total historical debt and newly introduced violations. CI metrics measured pass/fail outcomes and lint-related failures. MongoDB metrics measured duplicate groups, duplicate documents, and index readiness. Productivity-related metrics included deployment status, issue resolution time, and student survey scores. The metrics were interpreted descriptively rather than as evidence of general causal effects.

### Threats to Validity

Several threats may affect interpretation. Construct validity is limited because lint findings and duplicate records capture only selected dimensions of software quality. Internal validity is limited because changes in team behavior, workload, or feature complexity may affect CI outcomes independently of the intervention. External validity is limited by the single-project student context and the MERN stack. Conclusion validity is limited by the likely small number of CI runs and the descriptive nature of the analysis. Reliability may be affected by dependency changes, inconsistent use of branches, and changes to the MongoDB dataset during the study.
