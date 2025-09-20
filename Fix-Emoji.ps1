# Run this from the root of your Micro-Apps-Repository
# It will update ALL .html files inside it

$repoPath = "C:\path\to\Micro-Apps-Repository"   # <-- change this

# Define a hashtable of broken → fixed replacements
$replacements = @{
    "â€”" = "—";     # em-dash
    "â€“" = "–";     # en-dash
    "â€¦" = "…";     # ellipsis
    "â€¢" = "•";     # bullet
    "âœ…" = "✔️";   # check mark
    "âœ—" = "✖️";   # cross mark
    "ðŸ”Š" = "🔊";   # speaker
    "ðŸŽ„" = "🎄";   # Christmas tree (example)
    "ðŸ¥—" = "🥷";   # ninja (example, adjust if needed)
}

# Get all HTML files recursively
Get-ChildItem -Path $repoPath -Recurse -Filter *.html | ForEach-Object {
    $file = $_.FullName
    Write-Host "Processing $file"

    # Read file as UTF8 text
    $content = Get-Content -Raw -Encoding UTF8 $file

    # Apply replacements
    foreach ($bad in $replacements.Keys) {
        $good = $replacements[$bad]
        $content = $content -replace [Regex]::Escape($bad), [System.Text.RegularExpressions.Regex]::Escape($good) -replace '\\',''
    }

    # Write back as UTF8 (no BOM)
    [System.IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding $false))
}
