param(
  [string]$AppsRoot = "docs/apps",
  [string]$RenameMap = "rename-map.json",
  [switch]$DryRun
)

if (-not (Test-Path $AppsRoot)) {
  Write-Error "Apps root '$AppsRoot' not found. Run after moving folders."
  exit 1
}

# Load rename map (optional but recommended)
$map = @{}
if (Test-Path $RenameMap) {
  $entries = Get-Content $RenameMap -Raw | ConvertFrom-Json
  foreach ($e in $entries) {
    # map oldName -> newSlug (for URL updates)
    $map[$e.oldName] = $e.newSlug
  }
  Write-Host "Loaded rename-map.json with $($map.Count) entries." -ForegroundColor Cyan
} else {
  Write-Host "No rename-map.json found. Will only fix shared paths and app-slug." -ForegroundColor Yellow
}

# Helper: get kebab folder name from path
function Get-SlugFromPath([string]$filePath) {
  Split-Path (Split-Path $filePath -Parent) -Leaf
}

# Regex preps
$metaRegex = '<meta\s+name=["'']app-slug["'']\s+content=["'']([^"'']*)["'']\s*/?>'
$hrefShared = '../shared/'
$srcShared  = '../shared/'

# replacement targets
$newHrefShared = '../../shared/'
$newSrcShared  = '../../shared/'

# Optional internal link regex (URLs like /micro-apps-repository/Old_Name/)
$repoName = (Split-Path (Get-Location).Path -Leaf)  # folder name; OK for local checks
# Safer: accept any repo; we’ll only replace if segment matches an oldName in map
$internalUrlPattern = '/[^/]+/([^/]+)/'  # capture the app segment after repo (very general)

$files = Get-ChildItem -Path $AppsRoot -Recurse -Filter "index.html"

Write-Host "Scanning $($files.Count) app pages under $AppsRoot..." -ForegroundColor Cyan

foreach ($f in $files) {
  $slug = Get-SlugFromPath $f.FullName
  $orig = Get-Content $f.FullName -Raw

  $content = $orig

  # 1) Ensure/replace app-slug meta
  if ($content -match $metaRegex) {
    $content = [regex]::Replace($content, $metaRegex, "<meta name=""app-slug"" content=""$slug"">")
  } else {
    # insert before </head> if possible; else at top of <head>
    if ($content -match "</head>") {
      $content = $content -replace "</head>", "  <meta name=""app-slug"" content=""$slug"">`r`n</head>"
    } else {
      $content = "<meta name=""app-slug"" content=""$slug"">`r`n" + $content
    }
  }

  # 2) Fix shared asset paths (relative depth changed because apps moved into /docs/apps/)
  $content = $content -replace [regex]::Escape($hrefShared), $newHrefShared
  $content = $content -replace [regex]::Escape($srcShared),  $newSrcShared

  # 3) Optional: update internal links to old app paths using rename-map
  if ($map.Count -gt 0) {
    # Find segments like ".../<something>/Old_Name/..."
    $content = [regex]::Replace($content, $internalUrlPattern, {
      param($m)
      $segment = $m.Groups[1].Value
      if ($map.ContainsKey($segment)) {
        # rewrite to /apps/<new-slug>/
        return "/$($repoName)/apps/$($map[$segment])/"
      } else {
        # also try if the segment equals kebab of oldName variants (underscore/space)
        $alt = ($segment -replace "[ _]", "-").ToLower()
        $hit = $map.Keys | Where-Object { ($_ -replace "[ _]", "-").ToLower() -eq $alt }
        if ($hit) {
          return "/$($repoName)/apps/$($map[$hit[0]])/"
        }
        return $m.Value
      }
    })
  }

  if ($DryRun) {
    if ($content -ne $orig) { Write-Host "$($f.FullName): would modify" } else { Write-Host "$($f.FullName): ok" }
  } else {
    if ($content -ne $orig) {
      Copy-Item $f.FullName "$($f.FullName).bak" -Force
      Set-Content -Path $f.FullName -Value $content -Encoding UTF8
      Write-Host "$($f.FullName): updated"
    } else {
      Write-Host "$($f.FullName): ok"
    }
  }
}
