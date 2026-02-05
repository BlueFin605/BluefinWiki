# Aspire Setup Script for BlueFinWiki
# Run this script to install required .NET Aspire workload and dependencies

Write-Host "================================" -ForegroundColor Cyan
Write-Host "BlueFinWiki - Aspire Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check .NET version
Write-Host "Checking .NET SDK version..." -ForegroundColor Yellow
$dotnetVersion = dotnet --version
Write-Host "✓ .NET SDK version: $dotnetVersion" -ForegroundColor Green
Write-Host ""

# Install Aspire workload
Write-Host "Installing .NET Aspire workload..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
dotnet workload update
dotnet workload install aspire

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Aspire workload installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install Aspire workload" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check Docker
Write-Host "Checking Docker availability..." -ForegroundColor Yellow
$dockerRunning = docker info 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker is running" -ForegroundColor Green
} else {
    Write-Host "⚠ Docker is not running. Please start Docker Desktop." -ForegroundColor Yellow
    Write-Host "  LocalStack and MailHog containers require Docker." -ForegroundColor Gray
}
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ Node.js not found. Please install Node.js 18 or later." -ForegroundColor Yellow
}
Write-Host ""

# Build the AppHost project
Write-Host "Building Aspire AppHost project..." -ForegroundColor Yellow
Push-Location aspire/BlueFinWiki.AppHost
dotnet build
$buildResult = $LASTEXITCODE
Pop-Location

if ($buildResult -eq 0) {
    Write-Host "✓ AppHost built successfully" -ForegroundColor Green
} else {
    Write-Host "✗ AppHost build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Install frontend dependencies
if (Test-Path "frontend/package.json") {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location frontend
    npm install
    Pop-Location
    Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
    Write-Host ""
}

# Install backend dependencies
if (Test-Path "backend/package.json") {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
    Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
    Write-Host ""
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Ensure Docker Desktop is running" -ForegroundColor White
Write-Host "2. Run: " -NoNewline -ForegroundColor White
Write-Host "dotnet run --project aspire/BlueFinWiki.AppHost" -ForegroundColor Cyan
Write-Host "3. Open the Aspire Dashboard URL shown in the terminal" -ForegroundColor White
Write-Host "4. Access the frontend at http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "For detailed documentation, see:" -ForegroundColor Gray
Write-Host "  - aspire/ASPIRE-LOCAL-DEV.md" -ForegroundColor Gray
Write-Host "  - ASPIRE-SETUP.md" -ForegroundColor Gray
Write-Host ""
