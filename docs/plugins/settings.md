# Plugin Settings

MindStore now supports manifest-driven plugin settings in the product UI.

## How It Works

- A plugin declares `ui.settingsSchema` in its manifest.
- The plugin runtime validates incoming config against that schema.
- The Plugins page renders a settings form automatically from the same schema.

## Supported Field Types

- `text`
- `textarea`
- `password`
- `number`
- `boolean`
- `select`
- `file` as a path-or-token style text field for now

## Validation Rules

- Required fields are enforced.
- `number` fields respect `min` and `max`.
- `select` fields must match one of the declared options.
- String fields can use regex validation via `validation.pattern`.

## Why This Matters

This is one of the first steps toward a real community plugin platform: contributors can define configuration once and get consistent runtime validation plus a generated UI surface without writing one-off forms in the core app.
