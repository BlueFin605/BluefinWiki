# Infrastructure — BlueFinWiki

What this is: the AWS CDK app that deploys BlueFinWiki to real AWS. Everything lives in one CloudFormation stack (`UnifiedStack.cs`) covering storage (S3), database (DynamoDB), auth (Cognito), compute (Lambda + API Gateway), and CDN (CloudFront + S3 static hosting for the frontend).

Built with: AWS CDK v2, C#, .NET 10.

`infrastructure/README.md` is the unedited CDK-init boilerplate; `INFRASTRUCTURE.md` in this same folder is the real, detailed reference (stack contents, context parameters, environment differences, cost estimates, deploy/destroy commands, troubleshooting) — read that instead of expecting detail here.

## Where things are

- `src/Infrastructure/Program.cs` — CDK app entry point, environment/context wiring.
- `src/Infrastructure/Stacks/UnifiedStack.cs` — the single stack with all resources.
- `cdk.json` — CDK app configuration.
- `cdk.out/` — synthesized output (build artifact, not source).

## Running / using this area

Deploy/destroy/synth commands, environment config (`dev`/`staging`/`production`), and required context parameters are all in `INFRASTRUCTURE.md` and the repo-root `DEPLOY-AWS.md` — not duplicated here.
