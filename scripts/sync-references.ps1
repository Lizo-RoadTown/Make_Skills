# Clone or refresh architectural reference repos into platform\_reference\.
# These are gitignored — used for reading patterns while you write your own
# non-vendor-locked versions. NOT runtime dependencies.
#
# Run from the repo root: powershell -File scripts\sync-references.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RefDir = Join-Path $RepoRoot "platform\_reference"

if (-not (Test-Path $RefDir)) {
    New-Item -ItemType Directory -Path $RefDir -Force | Out-Null
}

$Repos = @(
    @{ Name = "aiq";                Url = "https://github.com/NVIDIA-AI-Blueprints/aiq.git" }
    @{ Name = "open_deep_research"; Url = "https://github.com/langchain-ai/open_deep_research.git" }
    @{ Name = "deepagents";         Url = "https://github.com/langchain-ai/deepagents.git" }
)

foreach ($repo in $Repos) {
    $target = Join-Path $RefDir $repo.Name
    if (Test-Path (Join-Path $target ".git")) {
        Write-Host "Refreshing $target..."
        git -C $target pull --ff-only
    } else {
        Write-Host "Cloning $($repo.Url) into $target..."
        git clone --depth 1 $repo.Url $target
    }
}

Write-Host ""
Write-Host "Reference repos available under platform\_reference\:"
Get-ChildItem $RefDir | Select-Object -ExpandProperty Name
