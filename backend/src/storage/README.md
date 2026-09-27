# Storage Plugin — where to look

The pluggable storage architecture is documented across three focused docs
instead of one — pick the one for what you need:

- **Design rationale, on-disk format, S3 layout** — `S3-STORAGE-ARCHITECTURE.md`
- **How to write a new `StoragePlugin` implementation** — `PLUGIN-DEVELOPER-GUIDE.md`
- **How to run the integration test suite against LocalStack (Aspire)** — `TESTING-WITH-ASPIRE.md`

Current state: only `S3StoragePlugin` is implemented. GitHub and local-filesystem
backends are conceptual examples in `PLUGIN-DEVELOPER-GUIDE.md`, not shipped.
