# infuz · 每天 00:00 台北時間刷新最近 30 天貼文成效
# 由 Windows Task Scheduler 觸發

$ErrorActionPreference = 'Continue'
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$url = 'https://infuz-flax.vercel.app/api/infuz/cron/refresh-insights'
$logDir = 'C:\Users\vincent\Documents\claude\2026bangkok\infuz\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'refresh-insights.log'

"[$ts] === start ===" | Out-File -FilePath $log -Append -Encoding utf8

try {
    $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 300
    $summary = "total=$($resp.total) refreshed=$($resp.refreshed) errorTotal=$($resp.errorTotal)"
    "[$ts] OK · $summary" | Out-File -FilePath $log -Append -Encoding utf8
    if ($resp.errors -and $resp.errors.Count -gt 0) {
        $resp.errors | ForEach-Object { "[$ts]   err: $_" | Out-File -FilePath $log -Append -Encoding utf8 }
    }
    # LINE 通知 (成功簡短)
    try { & line "📊 infuz 成效已刷新 · $summary" 2>&1 | Out-Null } catch {}
}
catch {
    $msg = $_.Exception.Message
    "[$ts] FAIL · $msg" | Out-File -FilePath $log -Append -Encoding utf8
    try { & line "⚠ infuz 成效刷新失敗: $msg" 2>&1 | Out-Null } catch {}
}
