<#
.SYNOPSIS
  Automates Microsoft Entra ID (Azure AD) App Registration for Comail Microsoft 365 & Outlook.com integration.
.DESCRIPTION
  1. Verifies Azure CLI (`az`) is installed (or installs via winget if missing).
  2. Logs into Microsoft Entra ID (`az login --allow-no-subscriptions`) if not already signed in.
  3. Creates or updates the Entra App Registration "Comail (symm's Alpha)" (reference slug: comail-at) supporting both Work/School (M365) and Personal (Outlook.com) accounts.
  4. Configures Web Redirect URI (`http://localhost:3000/api/auth/microsoft/callback`) and Microsoft Graph delegated permissions:
     openid, profile, email, offline_access, User.Read, Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, Contacts.ReadWrite, Tasks.ReadWrite, Files.ReadWrite.
  5. Generates a client secret and writes MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI to .env.local without printing the secret to the console.
#>

param(
  [string]$AppName = "Comail (symm's Alpha)",
  [string]$AppSlug = "comail-at",
  [string]$RedirectUri = "http://localhost:3000/api/auth/microsoft/callback",
  [string[]]$AdditionalRedirectUris = @("https://comail.symmetricalboy.com/api/auth/microsoft/callback"),
  [string]$EnvFile = ".env.local"
)

$AllRedirectUris = @($RedirectUri) + @($AdditionalRedirectUris) | Select-Object -Unique

$ErrorActionPreference = "Continue"

Write-Host "=== Comail Microsoft OAuth2 / Graph API Setup ===" -ForegroundColor Cyan

# 1. Check Azure CLI (and auto-add standard install paths or install via winget if missing)
$azPaths = @(
  "$env:ProgramFiles\Microsoft SDKs\Azure\CLI2\wbin",
  "${env:ProgramFiles(x86)}\Microsoft SDKs\Azure\CLI2\wbin"
)
foreach ($p in $azPaths) {
  if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
    $env:Path = "$env:Path;$p"
  }
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  Write-Host "Azure CLI (az) is not installed. Installing Microsoft.AzureCLI via winget..." -ForegroundColor Yellow
  winget install --exact --id Microsoft.AzureCLI --accept-source-agreements --accept-package-agreements
  foreach ($p in $azPaths) {
    if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
      $env:Path = "$env:Path;$p"
    }
  }
  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "Azure CLI installed, but could not be found in PATH. Please open a new terminal and re-run ./scripts/setup-microsoft-oauth.ps1" -ForegroundColor Yellow
    exit 1
  }
}

# Disable Azure CLI v2 interactive subscription selector bug
az config set core.login_experience_v2=off *>$null

# 2. Check Azure login session
$accountJson = az account show --output json 2>$null
if ($LASTEXITCODE -ne 0 -or -not $accountJson) {
  Write-Host "Logging into Microsoft Entra ID..." -ForegroundColor Cyan
  az login --allow-no-subscriptions --output none
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI login failed."
  }
}

# 3. Check if app registration already exists (filter in PowerShell so apostrophes in $AppName don't break OData $filter)
Write-Host "Checking for existing Entra App Registration '$AppName'..." -ForegroundColor Cyan
$allAppsRaw = az ad app list --output json 2>$null
$allApps = if ($allAppsRaw) { @($allAppsRaw | ConvertFrom-Json) } else { @() }
$existingApps = @($allApps | Where-Object { $_.displayName -eq $AppName -or $_.serviceManagementReference -eq $AppSlug -or $_.displayName -eq $AppSlug })
$appId = $null

if ($existingApps -and $existingApps.Count -gt 0) {
  $appId = $existingApps[0].appId
  Write-Host "Found existing App Registration (Client ID: $appId). Updating configuration..." -ForegroundColor Green
  az ad app update `
    --id $appId `
    --display-name $AppName `
    --sign-in-audience AzureADandPersonalMicrosoftAccount `
    --service-management-reference $AppSlug `
    --web-redirect-uris $AllRedirectUris 2>$null | Out-Null
} else {
  Write-Host "Creating new Entra App Registration '$AppName' (slug: $AppSlug)..." -ForegroundColor Cyan
  # Pass $AppSlug during create to avoid Azure CLI's unescaped OData startswith(displayName,...) bug on apostrophes, then set full $AppName via update
  $createdAppRaw = az ad app create `
    --display-name $AppSlug `
    --sign-in-audience AzureADandPersonalMicrosoftAccount `
    --service-management-reference $AppSlug `
    --web-redirect-uris $AllRedirectUris `
    --output json
  if ($LASTEXITCODE -ne 0 -or -not $createdAppRaw) {
    throw "Failed to create Entra App Registration."
  }
  $createdApp = $createdAppRaw | ConvertFrom-Json
  $appId = $createdApp.appId
  az ad app update --id $appId --display-name $AppName 2>$null | Out-Null
  Write-Host "Created App Registration '$AppName' (Client ID: $appId)." -ForegroundColor Green
}

# 4. Configure Microsoft Graph Delegated Permissions
# Microsoft Graph App ID: 00000003-0000-0000-c000-000000000000
$graphAppId = "00000003-0000-0000-c000-000000000000"
$delegatedScopeIds = @(
  "37f7f235-527c-4136-accd-4a02d197296e=Scope", # openid
  "14dad69e-099b-42c9-810b-d002981feec1=Scope", # profile
  "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0=Scope", # email
  "7427e0e9-2fba-42fe-b0c0-848c9e6a8182=Scope", # offline_access
  "e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope", # User.Read
  "024d486e-b451-40bb-833d-3e66d98c5c73=Scope", # Mail.ReadWrite
  "e383f46e-2787-4529-855e-0e479a3ffac0=Scope", # Mail.Send
  "1ec239c2-d7c9-4623-a91a-a9775856bb36=Scope", # Calendars.ReadWrite
  "d56682ec-c09e-4743-aaf4-1a3aac4caa21=Scope", # Contacts.ReadWrite
  "2219042f-cab5-40cc-b0d2-16b1540b4c5f=Scope", # Tasks.ReadWrite
  "5c28f0bf-8a70-41f1-8ab2-9032436ddb65=Scope"  # Files.ReadWrite
)

Write-Host "Adding Microsoft Graph delegated permissions..." -ForegroundColor Cyan
az ad app permission add --id $appId --api $graphAppId --api-permissions $delegatedScopeIds 2>$null | Out-Null

# 5. Create Client Secret (captured in memory, never printed)
Write-Host "Generating Client Secret..." -ForegroundColor Cyan
$credRaw = az ad app credential reset `
  --id $appId `
  --append `
  --display-name $AppSlug `
  --years 2 `
  --output json 2>$null
$credJson = if ($credRaw) { $credRaw | ConvertFrom-Json } else { $null }

$clientSecret = $credJson.password
if (-not $clientSecret) {
  throw "Failed to generate client secret from Azure CLI."
}

# 6. Update .env.local safely without logging secrets
$envPath = Join-Path (Get-Location) $EnvFile
$lines = @()
if (Test-Path $envPath) {
  $lines = @(Get-Content $envPath)
}

$filteredLines = $lines | Where-Object {
  $_ -notmatch '^\s*MICROSOFT_CLIENT_ID=' -and
  $_ -notmatch '^\s*MICROSOFT_CLIENT_SECRET=' -and
  $_ -notmatch '^\s*MICROSOFT_REDIRECT_URI='
}

$filteredLines += "MICROSOFT_CLIENT_ID=$appId"
$filteredLines += "MICROSOFT_CLIENT_SECRET=$clientSecret"
$filteredLines += "MICROSOFT_REDIRECT_URI=$RedirectUri"

Set-Content -Path $envPath -Value $filteredLines -Encoding UTF8

Write-Host ""
Write-Host "Successfully configured Microsoft OAuth credentials in $EnvFile!" -ForegroundColor Green
Write-Host "  App Display Name        = $AppName" -ForegroundColor White
Write-Host "  App Reference ID        = $AppSlug" -ForegroundColor White
Write-Host "  MICROSOFT_CLIENT_ID     = $appId" -ForegroundColor White
Write-Host "  MICROSOFT_REDIRECT_URI  = $RedirectUri" -ForegroundColor White
Write-Host "  MICROSOFT_CLIENT_SECRET = [SAVED TO $EnvFile]" -ForegroundColor White
Write-Host ""
Write-Host "Restart your Next.js dev server ('npm run dev') to pick up the new environment variables." -ForegroundColor Cyan
