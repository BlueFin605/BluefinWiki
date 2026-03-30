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


### Running web site Locally ###
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

.\manage-seed-data.ps1 -Action setup

node import-seed-data.js --source ./seed-snapshots/2026-03-30

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


# My big idea
I want to build a Kanban board into it, I know it is not a traditionl feature BUT The
  hierachical nature of the Wiki folders-->pages-->folders resembles the Eipc->Story->Task, and
  would introduce an element of flexibiloity, not forced into the same break down and limit of
  levels.  so my idea would be
  1. Introduce a concept of custom properties to a page, allowing to store named values of data
  types: string, number, date, tags. Note this introduces the concept of tags as well
  2. Introduce the ability to create different page types  which define the properties the page
  can have and which ones are compulsory. Users can make as many types as they want
     2.1 ability to define the type of tickets that can be created as a child to the page, do not
  negatively impact a standard wiki poage though
  3. Add a icon to a type and, and the name shoul dbe able to be changed, so maybe needs a GUID
  key and a name priperty
  4. now a user can create the the kanban tickets using the page types so we can build a
  rudementary kanban board
    4.1 The wiki page show the hierachy of pages and the type of "ticket"
    4.2 The state of the "ticket" would be a mandatory property of "state"
    4.3 I want it to track tv series, so maybe come with a preconfigured default ticket hieracy
  to represent a Show->Series