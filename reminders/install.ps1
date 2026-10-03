# Registers the Lock In reminders with Windows Task Scheduler (current user, no admin).
# Re-run any time to change times; run uninstall.ps1 to remove them.
param(
  [Parameter(Mandatory = $true)][string]$AppUrl,
  [string]$PremarketTime = '14:00',  # UK time, 30 min before the NY open
  [string]$EveningTime = '21:30'     # UK time, 30 min after the NY close
)

$script = Join-Path $PSScriptRoot 'remind.ps1'
Set-Content -Path (Join-Path $PSScriptRoot 'config.txt') -Value $AppUrl -Encoding utf8

function Add-Reminder($name, $trigger, $title, $message) {
  $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Title `"$title`" -Message `"$message`""
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $name -TaskPath '\LockIn\' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Registered: $name"
}

$weekdays = 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
Add-Reminder 'Pre-market' (New-ScheduledTaskTrigger -Weekly -DaysOfWeek $weekdays -At $PremarketTime) `
  'Pre-market check' 'Levels plotted? Plan written? Know your bias before the open.'
Add-Reminder 'Evening' (New-ScheduledTaskTrigger -Daily -At $EveningTime) `
  'Close out your day' 'Journal your trades, plot tomorrow''s levels, workout, homework. Open Lock In to see what''s left.'
