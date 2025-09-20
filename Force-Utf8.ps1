param(
  [string]$RepoPath = ".",
  [string[]]$Extensions = @("*.html","*.htm","*.js","*.css","*.json"),
  [switch]$WhatIf
)

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Scanning $RepoPath ..." -ForegroundColor Cyan

$files = foreach ($ext in $Extensions) {
  Get-ChildItem -Path $RepoPath -Recurse -File -Filter $ext -ErrorAction SilentlyContinue
}

foreach ($f in $files) {
  try {
    $text = Get-Content -Raw -Encoding Default $f.FullName

    # Add UTF-8 meta tag if it's an HTML file and missing
    if ($f.Extension -match '^\.(html|htm)$' -and $text -notmatch '<meta\s+charset\s*=\s*["'']?utf-?8') {
      $text = $text -replace '(<head[^>]*>)', "`$1`r`n  <meta charset=""utf-8"">"
    }

    $utf8Bytes = $Utf8NoBom.GetBytes($text)

    if ($WhatIf) {
      Write-Host "[DRY-RUN] Would convert: $($f.FullName)" -ForegroundColor Yellow
    } else {
      $bak = "$($f.FullName).bak"
      if (-not (Test-Path $bak)) {
        Copy-Item $f.FullName $bak
      }
      [System.IO.File]::WriteAllBytes($f.FullName, $utf8Bytes)
      Write-Host "Converted: $($f.FullName)" -ForegroundColor Green
    }
  }
  catch {
    Write-Host "Error on $($f.FullName): $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "Done." -ForegroundColor Cyan
