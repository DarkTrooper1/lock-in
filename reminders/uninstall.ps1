Get-ScheduledTask -TaskPath '\LockIn\' -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false
Write-Host 'Lock In reminders removed.'
