# Start Aspire with LocalStack and other containers
# This script sets required environment variables and starts the Aspire AppHost

Write-Host "Starting BlueFinWiki Aspire..." -ForegroundColor Cyan
Write-Host ""

# Set environment variables for Aspire
$env:ASPIRE_ALLOW_UNSECURED_TRANSPORT = "true"
$env:DOTNET_DASHBOARD_OTLP_ENDPOINT_URL = "http://localhost:4317"
$env:DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL = "http://localhost:4318"
$env:ASPNETCORE_URLS = "http://localhost:15888"

Write-Host "Starting Aspire AppHost..." -ForegroundColor Yellow
Write-Host "This will start the following containers:" -ForegroundColor Gray
Write-Host "  - LocalStack (AWS emulation) on port 4566" -ForegroundColor Gray
Write-Host "  - Cognito Local (authentication) on port 9229" -ForegroundColor Gray
Write-Host "  - MailHog (SMTP testing) on ports 1025 (SMTP) and 8025 (UI)" -ForegroundColor Gray
Write-Host ""

# Start Aspire
$appHostProject = Join-Path $PSScriptRoot "aspire/BlueFinWiki.AppHost/BlueFinWiki.AppHost.csproj"
dotnet run --project $appHostProject
