<#
.SYNOPSIS
    Manage BlueFinWiki seed data snapshots

.DESCRIPTION
    Export and import seed data for BlueFinWiki Aspire development environment.
    This script helps you capture and restore test data including S3 objects and DynamoDB items.

.PARAMETER Action
    The action to perform: export, import, setup, reset

.PARAMETER Source
    Source directory for import (required for import action)

.PARAMETER Output
    Output directory for export (optional, defaults to timestamped snapshot)

.EXAMPLE
    .\manage-seed-data.ps1 -Action export
    Exports current data to a timestamped snapshot

.EXAMPLE
    .\manage-seed-data.ps1 -Action export -Output "my-snapshot"
    Exports current data to ./seed-snapshots/my-snapshot

.EXAMPLE
    .\manage-seed-data.ps1 -Action import -Source "seed-snapshots/2026-03-30"
    Imports data from the specified snapshot

.EXAMPLE
    .\manage-seed-data.ps1 -Action setup
    Runs full setup: init tables + seed baseline data

.EXAMPLE
    .\manage-seed-data.ps1 -Action reset -Source "seed-snapshots/2026-03-30"
    Resets environment and restores from snapshot
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('export', 'import', 'setup', 'reset', 'list')]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string]$Source,
    
    [Parameter(Mandatory=$false)]
    [string]$Output
)

$ScriptDir = $PSScriptRoot
Set-Location $ScriptDir

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  BlueFinWiki Seed Data Manager" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    'export' {
        Write-Host "Exporting current seed data..." -ForegroundColor Yellow
        Write-Host ""
        
        if ($Output) {
            node export-seed-data.js --output "seed-snapshots/$Output"
        } else {
            node export-seed-data.js
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "Export completed successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "To import this data later:" -ForegroundColor Cyan
            if ($Output) {
                Write-Host "  .\manage-seed-data.ps1 -Action import -Source 'seed-snapshots/$Output'" -ForegroundColor White
            } else {
                $date = Get-Date -Format "yyyy-MM-dd"
                Write-Host "  .\manage-seed-data.ps1 -Action import -Source 'seed-snapshots/$date'" -ForegroundColor White
            }
        } else {
            Write-Host "Export failed!" -ForegroundColor Red
            exit 1
        }
    }
    
    'import' {
        if (-not $Source) {
            Write-Host "Error: -Source parameter is required for import action" -ForegroundColor Red
            Write-Host ""
            Write-Host "Usage: .\manage-seed-data.ps1 -Action import -Source 'seed-snapshots/2026-03-30'" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Importing seed data from: $Source" -ForegroundColor Yellow
        Write-Host ""
        
        node import-seed-data.js --source $Source
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "Import completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "Import failed!" -ForegroundColor Red
            exit 1
        }
    }
    
    'setup' {
        Write-Host "Setting up fresh environment with baseline data..." -ForegroundColor Yellow
        Write-Host ""
        
        Write-Host "Step 1/3: Initializing DynamoDB tables..." -ForegroundColor Cyan
        npm run init-db
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to initialize tables!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "Step 2/3: Seeding baseline data..." -ForegroundColor Cyan
        npm run seed
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to seed data!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "Step 3/3: Setting up Cognito..." -ForegroundColor Cyan
        npm run setup-cognito
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "==================================================================" -ForegroundColor Green
            Write-Host "  Environment setup complete!" -ForegroundColor Green
            Write-Host "==================================================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Test Credentials:" -ForegroundColor Cyan
            Write-Host "  Admin:    admin@bluefinwiki.local / Test123!" -ForegroundColor White
            Write-Host "  Standard: user@bluefinwiki.local / Test123!" -ForegroundColor White
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "  1. Start creating your test data" -ForegroundColor White
            Write-Host "  2. Export snapshot: .\manage-seed-data.ps1 -Action export" -ForegroundColor White
        } else {
            Write-Host "Failed to setup Cognito!" -ForegroundColor Red
            exit 1
        }
    }
    
    'reset' {
        Write-Host "WARNING: This will reset your LocalStack data!" -ForegroundColor Red
        Write-Host ""
        
        if (-not $Source) {
            Write-Host "No source specified - will reset to baseline data" -ForegroundColor Yellow
            $resetToBaseline = $true
        } else {
            Write-Host "Will restore from: $Source" -ForegroundColor Yellow
            $resetToBaseline = $false
        }
        
        Write-Host ""
        $confirm = Read-Host "Continue? (yes/no)"
        
        if ($confirm -ne 'yes') {
            Write-Host "Reset cancelled." -ForegroundColor Yellow
            exit 0
        }
        
        Write-Host ""
        Write-Host "Resetting environment..." -ForegroundColor Yellow
        Write-Host ""
        
        # Navigate to AppHost directory
        $appHostPath = Join-Path $ScriptDir ".." "BlueFinWiki.AppHost"
        $localStackDataPath = Join-Path $appHostPath "localstack-data"
        
        if (Test-Path $localStackDataPath) {
            Write-Host "Removing LocalStack data..." -ForegroundColor Cyan
            Remove-Item -Path $localStackDataPath -Recurse -Force
            Write-Host "LocalStack data removed" -ForegroundColor Green
        } else {
            Write-Host "No LocalStack data to remove" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "Please restart Aspire, then run this script again with:" -ForegroundColor Cyan
        if ($resetToBaseline) {
            Write-Host "  .\manage-seed-data.ps1 -Action setup" -ForegroundColor White
        } else {
            Write-Host "  .\manage-seed-data.ps1 -Action import -Source '$Source'" -ForegroundColor White
        }
    }
    
    'list' {
        Write-Host "Available seed snapshots:" -ForegroundColor Yellow
        Write-Host ""
        
        $snapshotsDir = Join-Path $ScriptDir "seed-snapshots"
        
        if (Test-Path $snapshotsDir) {
            $snapshots = Get-ChildItem -Path $snapshotsDir -Directory | Where-Object { $_.Name -ne '.git' }
            
            if ($snapshots.Count -eq 0) {
                Write-Host "No snapshots found." -ForegroundColor Gray
                Write-Host ""
                Write-Host "Create one with:" -ForegroundColor Cyan
                Write-Host "  .\manage-seed-data.ps1 -Action export" -ForegroundColor White
            } else {
                foreach ($snapshot in $snapshots) {
                    Write-Host "  $($snapshot.Name)" -ForegroundColor White
                    
                    $metadataPath = Join-Path $snapshot.FullName "metadata.json"
                    if (Test-Path $metadataPath) {
                        $metadata = Get-Content $metadataPath | ConvertFrom-Json
                        Write-Host "     Exported: $($metadata.exportedAt)" -ForegroundColor Gray
                    }
                    Write-Host ""
                }
                
                Write-Host "To import a snapshot:" -ForegroundColor Cyan
                Write-Host "  .\manage-seed-data.ps1 -Action import -Source 'seed-snapshots/SNAPSHOT_NAME'" -ForegroundColor White
            }
        } else {
            Write-Host "No snapshots directory found." -ForegroundColor Gray
        }
    }
}

Write-Host ""
