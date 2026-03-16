Start Aspire
    .\start-aspire.ps1

View the Aspiredashboard at http://localhost:15888
Access LocalStack at http://localhost:4566
View MailHog UI at http://localhost:8025
Test Cognito Local at http://localhost:9229

LocalStack Dashboard: https://app.localstack.cloud/inst/default/resources/dynamodb

## Tests

### run all tests
npm run test

### front end tests
cd frontend
npm test

### back end tests
cd backend
npm test                    # Unit tests only
npm run test:integration    # Integration tests only
npm run test:all            # Both unit and integration tests


### Running wediste Locally ###
 cd frontend
 npm run dev

Admin Account:
Email: admin@bluefinwiki.local
Password: Test123!

Standard User Account:
Email: user@bluefinwiki.local
Password: Test123!

### Seed database
cd aspire\scripts
node import-seed-data.js --source ./seed-snapshots/2026-03-03

-- .\manage-seed-data.ps1 -Action import -Source "seed-snaps


### Deploy Infrastructure

All commands run from the `infrastructure` directory:
```
cd infrastructure
```

#### Preview changes first
```
cdk diff --context environment=production
```

#### Deploy (all stacks)
```
cdk deploy --context environment=production --all --require-approval never
```

#### Deploy production with custom domain (wiki.bluefin605.com)
Option 1 - Use the deploy script (handles certificate lookup automatically):
```powershell
.\deploy-production.ps1
```

Option 2 - Manual deploy with cert ARNs:
```
cdk deploy BlueFinWiki-production \
    -c environment=production \
    -c domainName=wiki.bluefin605.com \
    -c certificateArnUsEast1=arn:aws:acm:us-east-1:ACCOUNT:certificate/XXXX \
    -c certificateArnRegional=arn:aws:acm:ap-southeast-2:ACCOUNT:certificate/YYYY
```

#### Deploy dev environment
```
cdk deploy --context environment=dev --all
```
