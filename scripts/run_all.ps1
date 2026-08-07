# Convenience loop: transcribe every incomplete episode, oldest first.
# Runs exactly one process at a time until every catalog entry is done.
param(
    [string]$Model = "large-v3-turbo",
    [switch]$Quiet
)

$py = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

$extra = @("--model", $Model)
if ($Quiet) { $extra += "--quiet" }

while ($true) {
    & $py "-u" (Join-Path $PSScriptRoot "transcribe_episode.py") @extra
    $ok = $LASTEXITCODE -eq 0
    if (-not $ok) {
        Write-Host "Pipeline stopped (episode error). Inspect data/catalog.json and re-run, or use --index to retry a specific episode." -ForegroundColor Red
        break
    }
    $catalog = Get-Content (Join-Path $PSScriptRoot "..\data\catalog.json") -Raw | ConvertFrom-Json
    $incomplete = @($catalog.episodes | Where-Object { $_.status -ne "done" })
    if ($incomplete.Count -eq 0) { break }
    Write-Host "=== $($incomplete.Count) remaining ===" -ForegroundColor Cyan
}
Write-Host "All done."

Get-ChildItem -Recurse data\transcripts\*.txt 2>$null | Measure-Object | ForEach-Object {
    Write-Host "$($_.Count) transcripts written."
}
