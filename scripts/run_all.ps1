# Convenience loop: transcribe every pending episode, oldest first.
# Runs the one-at-a-time pipeline until the manifest has no pending episodes.
param(
    [string]$Model = "large-v3-turbo"
)

$py = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

while ($true) {
    & $py (Join-Path $PSScriptRoot "transcribe_episode.py") --model $Model
    $ok = $LASTEXITCODE -eq 0
    if (-not $ok) {
        Write-Host "Pipeline stopped (episode error). Inspect data/catalog.json and re-run, or use --index to retry a specific episode." -ForegroundColor Red
        break
    }
    $catalog = Get-Content (Join-Path $PSScriptRoot "..\data\catalog.json") -Raw | ConvertFrom-Json
    $pending = @($catalog.episodes | Where-Object { $_.status -eq "pending" })
    if ($pending.Count -eq 0) { break }
    Write-Host "=== $($pending.Count) remaining ===" -ForegroundColor Cyan
}
Write-Host "All done."

Get-ChildItem -Recurse data\transcripts\*.txt 2>$null | Measure-Object | ForEach-Object {
    Write-Host "$($_.Count) transcripts written."
}