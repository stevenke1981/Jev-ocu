param([string]$Title = 'Jev isolated native smoke fixture')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = $Title
$form.Width = 420; $form.Height = 250
$form.StartPosition = 'CenterScreen'
$edit = New-Object System.Windows.Forms.TextBox
$edit.Name = 'JevSmokeEdit'; $edit.AccessibleName = 'Jev smoke edit'
$edit.Location = New-Object System.Drawing.Point(20,20); $edit.Width=320
$button = New-Object System.Windows.Forms.Button
$button.Name='JevSmokeButton'; $button.Text='Increment'; $button.AccessibleName='Increment'
$button.Location=New-Object System.Drawing.Point(20,60)
$label = New-Object System.Windows.Forms.Label
$label.Text='Counter 0'; $label.AccessibleName='Counter 0'; $label.AutoSize=$true
$label.Location=New-Object System.Drawing.Point(20,105)
$button.Add_Click({ $label.Text='Counter 1'; $label.AccessibleName='Counter 1' })
$form.Controls.AddRange(@($edit,$button,$label))
$form.Add_Shown({$form.Activate()})
[void]$form.ShowDialog()
$form.Dispose()
