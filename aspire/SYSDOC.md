# Aspire — BlueFinWiki

What this is: local dev orchestration for the whole stack, via Microsoft Aspire. Starts LocalStack (S3/DynamoDB/SES), Cognito Local, MailHog, the backend (as a Node/Express app), and the frontend (as `ng serve`) as one unit, wired together with matching env vars. Local-only — never used in production (see `../infrastructure/SYSDOC.md` and `aspire/README.md`'s "Production vs Local" section for the local/prod mapping).

Built with: Aspire AppHost (.NET 10), `Aspire.Hosting.JavaScript` (`AddJavaScriptApp`) for running the Node-based frontend/backend as orchestrated resources.

Full service list, ports, environment variables, and troubleshooting steps are already documented in `aspire/README.md` — not repeated here.

## Where things are

- `BlueFinWiki.AppHost/Program.cs` — the orchestration definition itself (what starts, in what order, with what env vars). See the repo-root `SYSDOC.md` for a summary of what it wires up.
- `BlueFinWiki.ServiceDefaults/` — shared OpenTelemetry/health-check/service-discovery config applied to the orchestrated services.
- `scripts/` — DynamoDB table init and seed-data scripts (`init-db`, `seed`, `setup`); see `scripts/README.md`.
- `LOCAL-COGNITO-SETUP.md`, `LOCAL-DATABASE-SETUP.md`, `SEED-DATA.md`, `ASPIRE-LOCAL-DEV.md` — deep-dive guides for specific pieces of the local stack.

## Running / using this area

Covered fully by `aspire/README.md` ("Running Locally", "Seed Data Management", "Troubleshooting"). One thing to know going in: run `../setup-aspire.ps1` once (repo root) before the first `dotnet run`, and `../start-aspire.ps1` for subsequent starts — see the repo-root README's Getting Started section.
