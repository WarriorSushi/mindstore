# Security Policy

MindStore is a personal knowledge product. Security issues can expose private memories, provider credentials, or deployment infrastructure, so please report them responsibly.

## Reporting

Please do not open public issues for security vulnerabilities.

Send a report that includes:

- A short summary of the issue
- Impacted versions or branches
- Steps to reproduce
- Proof-of-concept details when safe
- Suggested remediation if you have one

Until a dedicated security inbox is established, use a private maintainer channel and mark the report as `security`.

## Secret Handling

- Never commit real secrets, production URLs with credentials, or live tokens to the repository.
- Prefer environment variables or secret stores over tracked configuration.
- If a secret was ever committed, rotate it immediately even if it is later removed from git history.

## Current Notice

This repository previously contained literal production credentials in `PRODUCTION.md`. Those values must be treated as compromised and rotated out-of-band.

## Supported Fix Window

Security fixes should be prioritized ahead of feature work when the issue affects:

- Authentication or session handling
- MCP exposure
- Plugin execution or sandbox boundaries
- Secret storage
- Import pipelines that process untrusted content
