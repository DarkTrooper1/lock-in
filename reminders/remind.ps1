# Shows a Windows notification that stays on screen until dismissed.
# Clicking it opens Lock In.
param(
  [string]$Title = 'Lock In',
  [string]$Message = 'Check your list.',
  [string]$Url = ''
)

if (-not $Url) {
  $cfg = Join-Path $PSScriptRoot 'config.txt'
  $Url = if (Test-Path $cfg) { (Get-Content $cfg -Raw).Trim() } else { 'https://github.com' }
}

[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$e = [System.Security.SecurityElement]
$u = $e::Escape($Url)
$xml = @"
<toast activationType="protocol" launch="$u" scenario="reminder">
  <visual><binding template="ToastGeneric">
    <text>$($e::Escape($Title))</text>
    <text>$($e::Escape($Message))</text>
  </binding></visual>
  <actions>
    <action content="Open Lock In" activationType="protocol" arguments="$u"/>
    <action content="Dismiss" activationType="system" arguments="dismiss"/>
  </actions>
</toast>
"@

$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xml)
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show([Windows.UI.Notifications.ToastNotification]::new($doc))
