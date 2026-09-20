# No profile, no network, no elevation. UIA runs in this dedicated MTA process.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    if ($PSVersionTable.PSEdition -ne 'Desktop') { throw 'Use built-in Windows PowerShell 5.1, not pwsh.' }
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, WindowsBase, System.Drawing, System.Windows.Forms, System.Web.Extensions
    $refs = @(
        [System.Windows.Automation.AutomationElement].Assembly.Location,
        [System.Windows.Automation.AutomationPattern].Assembly.Location,
        [System.Windows.Rect].Assembly.Location,
        [System.Drawing.Bitmap].Assembly.Location,
        [System.Windows.Forms.Form].Assembly.Location,
        [System.Web.Script.Serialization.JavaScriptSerializer].Assembly.Location,
        'System.dll', 'System.Core.dll'
    ) | Select-Object -Unique
    Add-Type -Path (Join-Path $PSScriptRoot 'native.cs') -ReferencedAssemblies $refs
    while ($null -ne ($line = [Console]::ReadLine())) {
        if ($line.Length -gt 0) { [Console]::WriteLine([Jev.NativeDesktop]::Dispatch($line)) }
    }
} catch {
    [Console]::Error.WriteLine('Jev Windows backend could not start: ' + $_.Exception.Message)
    exit 1
}
