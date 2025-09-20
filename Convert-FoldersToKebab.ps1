param(
  [string]$DocsRoot = "docs",
  [string]$AppsRoot = "docs/apps",
  [switch]$WhatIf  # preview only
)

function To-Kebab([string]$name) {
  $s = $name -replace "[ _]", "-"           # spaces/underscores -> hyphen
  $s = $s -replace "[^A-Za-z0-9\-]", ""     # drop non url-safe
  $s = $s.ToLower()
  $s = $s -replace "-{2,}", "-"             # collapse hyphens
  $s.Trim("-")
}

# Ensure target exists
if (-not (Test-Path $AppsRoot)) { New-Item -ItemType Directory -Path $AppsRoot | Out-Null }

# Folders to ignore under docs
$ignore = @("apps","shared","assets",".git","node_modules")

# discover candidate app folders (immediate children of docs/)
$folders = Get-ChildItem -Path $DocsRoot -Directory | Where-Object { $ignore -notcontains $_.Name }

if ($folders.Count -eq 0) {
  Write-Host "No app folders found under '$DocsRoot'." -ForegroundColor Yellow
  exit 0
}

# Build rename map
$map = @{}
foreach ($f in $folders) {
  $newSlug = To-Kebab $f.Name
  $target = Join-Path $AppsRoot $newSlug
  $map[$f.FullName] = $target
}

Write-Host "Planned moves:" -ForegroundColor Cyan
$map.GetEnumerator() | ForEach-Object { "{0}  ->  {1}" -f $_.Key, $_.Value } | Write-Host

if ($WhatIf) {
  Write-Host "`nPreview only (--WhatIf). No changes made." -ForegroundColor Yellow
} else {
  # Write rename map (oldName -> newSlug) for downstream scripts
  $pairList = @()
  foreach ($f in $folders) {
    $pairList += [pscustomobject]@{
      oldPath = $f.FullName
      oldName = $f.Name
      newSlug = (To-Kebab $f.Name)
      newPath = (Join-Path $AppsRoot (To-Kebab $f.Name))
    }
  }
  $mapPath = Join-Path (Get-Location) "rename-map.json"
  $pairList | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $mapPath
  Write-Host "`nSaved rename map -> $mapPath" -ForegroundColor Green

  # Use git mv if available
  $git = (Get-Command git -ErrorAction SilentlyContinue)
  foreach ($entry in $pairList) {
    if (Test-Path $entry.newPath) {
      Write-Host "Target exists, skipping: $($entry.newPath)" -ForegroundColor Yellow
      continue
    }
    $targetParent = Split-Path $entry.newPath -Parent
    if (-not (Test-Path $targetParent)) { New-Item -ItemType Directory -Path $targetParent | Out-Null }

    if ($git) {
      Write-Host "git mv `"$($entry.oldPath)`" `"$($entry.newPath)`""
      git mv "$($entry.oldPath)" "$($entry.newPath)"
    } else {
      Write-Host "Move-Item `"$($entry.oldPath)`" `"$($entry.newPath)`""
      Move-Item "$($entry.oldPath)" "$($entry.newPath)"
    }
  }

  Write-Host "`nDone. Review 'git status' and commit on a branch (e.g., 'restructure')." -ForegroundColor Green
}
