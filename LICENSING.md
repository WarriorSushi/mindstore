# MindStore Licensing

This document explains the current licensing state of the MindStore repository and the intended direction for the project.

It is a project policy document, not legal advice.

## Current License

The MindStore repository is currently licensed under the [MIT License](./LICENSE).

That means:

- people may use, modify, distribute, and sell copies of the software
- the license and copyright notice must be preserved
- the software is provided without warranty

This applies to the repository code unless a subdirectory or file says otherwise.

## Why This Document Exists

MindStore is being built to support:

- broad community adoption
- a healthy plugin and skills ecosystem
- future commercial sustainability
- trust from self-hosters, contributors, and companies

Those goals often pull in different directions. This document makes the current state explicit so users and contributors are not left guessing.

## Important Reality About The Current Repo

The repository has already been published under MIT.

That means previously granted MIT rights cannot simply be treated as if they never existed. Any future relicensing of the core codebase needs to be handled deliberately and with contributor-rights awareness.

## Planned Long-Term Direction

The likely long-term licensing model for MindStore is:

- core application and server: stronger copyleft model such as AGPL, if and when contributor rights and governance make that feasible
- plugin SDK, examples, and ecosystem-facing developer surfaces: permissive licensing so the plugin ecosystem remains easy to adopt
- brand assets, names, and logos: protected separately through trademark policy
- commercial offerings: hosted service, support, enterprise add-ons, and commercial agreements where appropriate

This direction is not fully enacted by this document. It is the strategic direction the maintainers intend to evaluate and formalize over time.

## Plugins And Skills

MindStore is designed to encourage third-party plugins, skills, automations, and integrations.

Plugin authors may choose their own licenses for independently distributed plugins, subject to compatibility with any code they copy or derive from this repository.

For ecosystem health, MindStore generally recommends:

- `MIT` or `Apache-2.0` for standalone plugins and examples
- clear notices when plugin code includes or derives from MindStore code
- avoiding misleading use of MindStore branding

## Contributions

Unless otherwise stated, contributions to this repository are accepted under the repository's current outbound license.

Contributors are also expected to certify origin using the Developer Certificate of Origin process described in [DCO.md](./DCO.md).

## Trademarks

Code licensing and trademark rights are different.

Even where code is permissively licensed, the project name, logos, and official branding are governed by [TRADEMARKS.md](./TRADEMARKS.md).

## If You Need Different Rights

If you want:

- commercial branding rights
- a trademark license
- support commitments
- a future commercial agreement for proprietary or hosted use

contact the project maintainers rather than guessing from the open source license alone.
