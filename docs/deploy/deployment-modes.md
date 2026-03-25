# Deployment Modes

MindStore should be easy to run for one person today and still have a path to hosted scale later.

## Local Developer

Use this mode for day-to-day development.

- Fastest feedback loop
- Local `.env`
- Same import, search, and MCP surfaces as production

## Self-Hosted Single User

Use this when one person wants a personal memory layer with the least operational overhead.

- Default fallback user flow
- Simple database and provider setup
- Good fit for homelabs and VPS installs

## Self-Hosted Small Team

Use this when a small group needs shared infrastructure with stronger auth expectations.

- Session-backed auth matters more
- Deployment docs must call out secret handling and backups
- Plugin and MCP access should be documented clearly per environment

## Hosted-Ready

This mode is the architecture target for future managed hosting.

- Stronger secret isolation
- Better job processing and observability
- More explicit tenant and plugin safety boundaries
