<#
.SYNOPSIS
    Deploy BlueFinWiki production stack with custom domain support.
.DESCRIPTION
    Looks up (or creates) ACM certificates for wiki.bluefin605.com,
    then runs cdk deploy with the correct context parameters.
#>

$ErrorActionPreference = "Stop"

$DomainName       = "wiki.bluefin605.com"
$AuthDomain       = "auth.$DomainName"
$ApiDomain        = "api.$DomainName"
$Region           = "ap-southeast-2"
$GlobalRegion     = "us-east-1"
$StackEnvironment = "production"

# --- Helper: find a cert covering all required SANs in a given region ---
function Find-Certificate {
    param(
        [string]$Region,
        [string[]]$RequiredDomains
    )
    $certs = aws acm list-certificates --region $Region --output json | ConvertFrom-Json
    foreach ($cert in $certs.CertificateSummaryList) {
        if ($cert.Status -ne "ISSUED") { continue }
        $sans = $cert.SubjectAlternativeNameSummaries
        $allFound = $true
        foreach ($d in $RequiredDomains) {
            if ($sans -notcontains $d) { $allFound = $false; break }
        }
        if ($allFound) { return $cert.CertificateArn }
    }
    return $null
}

Write-Host "=== BlueFinWiki Production Deploy ===" -ForegroundColor Cyan
Write-Host ""

# --- us-east-1 certificate (CloudFront + Cognito) ---
$globalDomains = @($DomainName, $AuthDomain)
Write-Host "Looking for us-east-1 certificate covering: $($globalDomains -join ', ')..."
$certUsEast1 = Find-Certificate -Region $GlobalRegion -RequiredDomains $globalDomains

if (-not $certUsEast1) {
    Write-Host "  No matching certificate found in us-east-1." -ForegroundColor Yellow
    Write-Host "  You need to create one covering: $($globalDomains -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    $create = Read-Host "Create it now? (y/n)"
    if ($create -eq "y") {
        Write-Host "  Requesting certificate..."
        $result = aws acm request-certificate `
            --region $GlobalRegion `
            --domain-name $DomainName `
            --subject-alternative-names $AuthDomain `
            --validation-method DNS `
            --output json | ConvertFrom-Json
        $certUsEast1 = $result.CertificateArn
        Write-Host "  Certificate ARN: $certUsEast1" -ForegroundColor Green
        Write-Host ""
        Write-Host "  >>> Add the DNS validation CNAME records now, then press Enter to continue <<<" -ForegroundColor Yellow
        Write-Host "  Run this to see the records:" -ForegroundColor Gray
        Write-Host "  aws acm describe-certificate --region $GlobalRegion --certificate-arn $certUsEast1 --query 'Certificate.DomainValidationOptions'" -ForegroundColor Gray
        Read-Host "Press Enter once DNS records are added"

        Write-Host "  Waiting for certificate to be issued (this can take a few minutes)..."
        aws acm wait certificate-validated --region $GlobalRegion --certificate-arn $certUsEast1
        Write-Host "  Certificate issued!" -ForegroundColor Green
    } else {
        Write-Host "Aborting. Create the certificate manually and re-run." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Found: $certUsEast1" -ForegroundColor Green
}

# --- ap-southeast-2 certificate (API Gateway) ---
$regionalDomains = @($ApiDomain)
Write-Host ""
Write-Host "Looking for $Region certificate covering: $($regionalDomains -join ', ')..."
$certRegional = Find-Certificate -Region $Region -RequiredDomains $regionalDomains

if (-not $certRegional) {
    Write-Host "  No matching certificate found in $Region." -ForegroundColor Yellow
    Write-Host "  You need to create one covering: $($regionalDomains -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    $create = Read-Host "Create it now? (y/n)"
    if ($create -eq "y") {
        Write-Host "  Requesting certificate..."
        $result = aws acm request-certificate `
            --region $Region `
            --domain-name $ApiDomain `
            --validation-method DNS `
            --output json | ConvertFrom-Json
        $certRegional = $result.CertificateArn
        Write-Host "  Certificate ARN: $certRegional" -ForegroundColor Green
        Write-Host ""
        Write-Host "  >>> Add the DNS validation CNAME records now, then press Enter to continue <<<" -ForegroundColor Yellow
        Write-Host "  Run this to see the records:" -ForegroundColor Gray
        Write-Host "  aws acm describe-certificate --region $Region --certificate-arn $certRegional --query 'Certificate.DomainValidationOptions'" -ForegroundColor Gray
        Read-Host "Press Enter once DNS records are added"

        Write-Host "  Waiting for certificate to be issued (this can take a few minutes)..."
        aws acm wait certificate-validated --region $Region --certificate-arn $certRegional
        Write-Host "  Certificate issued!" -ForegroundColor Green
    } else {
        Write-Host "Aborting. Create the certificate manually and re-run." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Found: $certRegional" -ForegroundColor Green
}

# --- Google OAuth (optional) ---
# To enable: create a Secrets Manager secret named "bluefinwiki/production/google-oauth"
# with JSON: { "clientId": "xxx.apps.googleusercontent.com", "clientSecret": "xxx" }
$enableGoogle = $false
try {
    $googleSecret = aws secretsmanager describe-secret --secret-id "bluefinwiki/$StackEnvironment/google-oauth" --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        $enableGoogle = $true
        Write-Host ""
        Write-Host "Google OAuth secret found in Secrets Manager — Google login enabled" -ForegroundColor Green
    }
} catch {}

if (-not $enableGoogle) {
    Write-Host ""
    Write-Host "No Google OAuth secret found (create bluefinwiki/$StackEnvironment/google-oauth in Secrets Manager to enable)" -ForegroundColor Yellow
}

# --- CDK Deploy ---
Write-Host ""
Write-Host "=== Running CDK Deploy ===" -ForegroundColor Cyan
Write-Host "  Domain:     $DomainName"
Write-Host "  Auth:       $AuthDomain"
Write-Host "  API:        $ApiDomain"
Write-Host "  Cert (CF):  $certUsEast1"
Write-Host "  Cert (API): $certRegional"
Write-Host "  Google:     $(if ($enableGoogle) { 'Enabled' } else { 'Disabled' })"
Write-Host ""

Push-Location $PSScriptRoot
try {
    npx cdk deploy "BlueFinWiki-$StackEnvironment" `
        -c environment=$StackEnvironment `
        -c domainName=$DomainName `
        -c certificateArnUsEast1=$certUsEast1 `
        -c certificateArnRegional=$certRegional `
        -c enableCognitoCustomDomain=true `
        -c enableGoogleLogin=$($enableGoogle.ToString().ToLower()) `
        --require-approval broadening
} finally {
    Pop-Location
}

# --- Wire Cognito Lambda Triggers (post-CDK, avoids circular dependency) ---
Write-Host ""
Write-Host "=== Wiring Cognito Lambda Triggers ===" -ForegroundColor Cyan

$UserPoolId = aws cloudformation describe-stacks `
    --stack-name "BlueFinWiki-$StackEnvironment" `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" `
    --output text

$prefix = "bluefinwiki-$StackEnvironment"
$triggerFunctions = @{
    PreSignUp        = "$prefix-auth-pre-signup"
    PostConfirmation = "$prefix-auth-post-confirmation"
    PreTokenGeneration = "$prefix-auth-pre-token-gen"
    CustomMessage    = "$prefix-auth-custom-message"
}

# Build the lambda-config JSON
$lambdaConfig = @{}
foreach ($trigger in $triggerFunctions.GetEnumerator()) {
    $arn = aws lambda get-function --function-name $trigger.Value --region $Region --query "Configuration.FunctionArn" --output text 2>$null
    if ($arn) {
        $lambdaConfig[$trigger.Key] = $arn
        # Grant Cognito permission to invoke (idempotent)
        aws lambda add-permission `
            --function-name $trigger.Value `
            --statement-id "CognitoInvoke" `
            --action "lambda:InvokeFunction" `
            --principal "cognito-idp.amazonaws.com" `
            --source-arn "arn:aws:cognito-idp:${Region}:083148603667:userpool/${UserPoolId}" `
            --region $Region 2>$null
        Write-Host "  $($trigger.Key) -> $($trigger.Value)" -ForegroundColor Green
    } else {
        Write-Host "  $($trigger.Key) -> NOT FOUND (skipped)" -ForegroundColor Yellow
    }
}

$configJson = $lambdaConfig | ConvertTo-Json -Compress
aws cognito-idp update-user-pool `
    --user-pool-id $UserPoolId `
    --lambda-config $configJson `
    --region $Region 2>&1 | Out-Null

Write-Host "  Triggers wired to User Pool: $UserPoolId" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploy Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "DNS records to create:" -ForegroundColor Yellow
Write-Host "  $DomainName        -> CNAME to CloudFront (see DistributionDomainName output above)"
Write-Host "  $ApiDomain    -> CNAME to API Gateway (see ApiCustomDomainTarget output above)"
Write-Host "  $AuthDomain   -> CNAME to Cognito (check Cognito console for alias target)"
