Start Aspire
    .\start-aspire.ps1

View the dashboard at http://localhost:15888
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
.\manage-seed-data.ps1 -Action import -Source "seed-snaps