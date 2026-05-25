# Copies Startup Checkpoint module (backend + frontend) into another FPT-SMEP clone.
# Usage:
#   .\scripts\sync-checkpoint-module.ps1 -TargetRoot "D:\SU26\WDP301\Project\FPT-SMEP"

param(
  [Parameter(Mandatory = $true)]
  [string]$TargetRoot
)

$ErrorActionPreference = 'Stop'
$SourceRoot = Split-Path $PSScriptRoot -Parent
$TargetRoot = $TargetRoot.TrimEnd('\')

if (-not (Test-Path $TargetRoot)) {
  Write-Error "Target not found: $TargetRoot"
}

$Pairs = @(
  @("backend\src\config\checkpointConfig.js",           "backend\src\config\checkpointConfig.js"),
  @("backend\src\routes\checkpoint.routes.js",         "backend\src\routes\checkpoint.routes.js"),
  @("backend\src\controllers\checkpoint.controller.js","backend\src\controllers\checkpoint.controller.js"),
  @("backend\src\models\CheckpointFile.js",           "backend\src\models\CheckpointFile.js"),
  @("backend\src\models\CheckpointFeedback.js",       "backend\src\models\CheckpointFeedback.js"),
  @("backend\src\models\CheckpointSubmission.js",     "backend\src\models\CheckpointSubmission.js"),
  @("frontend\src\api\checkpointApi.js",               "frontend\src\api\checkpointApi.js"),
  @("frontend\src\components\workspace\checkpoints",   "frontend\src\components\workspace\checkpoints")
)

$copied = 0
foreach ($pair in $Pairs) {
  $src = Join-Path $SourceRoot $pair[0]
  $dst = Join-Path $TargetRoot $pair[1]

  if (-not (Test-Path $src)) {
    Write-Warning "Skip (missing source): $src"
    continue
  }

  $dstDir = Split-Path $dst -Parent
  if (-not (Test-Path $dstDir)) {
    New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
  }

  if (Test-Path $src -PathType Container) {
    Copy-Item $src $dst -Recurse -Force
  } else {
    Copy-Item $src $dst -Force
  }
  Write-Host "OK  $($pair[1])"
  $copied++
}

# Ensure app.js registers checkpoint routes (patch if missing)
$appJs = Join-Path $TargetRoot "backend\src\app.js"
if (Test-Path $appJs) {
  $content = Get-Content $appJs -Raw
  if ($content -notmatch 'checkpoint\.routes') {
    $content = $content -replace "(const weeklyTaskRoutes[^\r\n]+)", "`$1`r`nconst checkpointRoutes = require('./routes/checkpoint.routes');"
    $content = $content -replace "(app\.use\('/api/workspace', workspaceRoutes\);)", "`$1`r`napp.use('/api/workspace/checkpoints', checkpointRoutes);"
    Set-Content $appJs $content -NoNewline
    Write-Host "OK  patched backend\src\app.js (checkpoint routes)"
  }
}

Write-Host ""
Write-Host "Done. Copied $copied item(s) to $TargetRoot"
Write-Host "Next: cd `"$TargetRoot\backend`" ; npm install ; npm run dev"
