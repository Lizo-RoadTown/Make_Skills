# Clone or refresh the upstream skill libraries into skills/_upstream/.
# These are gitignored so the repo stays focused on your own skills.
# Run from the repo root: powershell -File scripts\sync-upstream.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Target = Join-Path $RepoRoot "skills\_upstream\anthropics-skills"
$Upstream = "https://github.com/anthropics/skills.git"

$TargetParent = Split-Path $Target -Parent
if (-not (Test-Path $TargetParent)) {
    New-Item -ItemType Directory -Path $TargetParent -Force | Out-Null
}

if (Test-Path (Join-Path $Target ".git")) {
    Write-Host "Refreshing $Target..."
    git -C $Target pull --ff-only
} else {
    Write-Host "Cloning $Upstream into $Target..."
    git clone $Upstream $Target
}

Write-Host ""
Write-Host "Available upstream skills:"
Get-ChildItem (Join-Path $Target "skills") | Select-Object -ExpandProperty Name
