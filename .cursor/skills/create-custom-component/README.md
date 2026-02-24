# create-custom-component — AI Skill for Building Custom Form Components

Guides you through creating a custom form component end-to-end: scaffolding,
implementation, model subscription wiring, registration, and validation.

## Requirements

- A forms project forked from aem-boilerplate-forms
- Node.js (for `npm run build:json`)
- (Optional) Cursor with browser MCP for validation step

## Installation

### Cursor

Unzip and move the `create-custom-component` folder to your Cursor skills directory:

```
.cursor/skills/create-custom-component/
```

### Claude Code

Move the folder to:

```
~/.claude/skills/create-custom-component/
```

### Folder structure after install

```
create-custom-component/
├── skill.md
├── README.md
├── tools/
│   ├── scaffold-component.sh
│   └── validate-registration.js
└── knowledge/
    └── (knowledge files are not included in cloned repos)
```

**Note**: The `knowledge/` folder exists for potential future documentation but currently does not contain files when you clone this repository. The skill is self-contained and does not require external knowledge files to function.

## Usage

Ask your coding assistant to create a custom component. Example queries:

- "Create a custom slider component based on number-input"
- "I need a custom date-of-birth field that validates age"
- "Build a custom dropdown with search/filter"
- "Create a rating component that extends number-input"

### Optional auto-routing

Add to your `.cursorrules`:

```
Read .cursor/skills/create-custom-component/skill.md when the user asks to
create, scaffold, or build a custom form component.
```

## What it does

1. Asks what OOTB component to extend and what properties you need
2. Scaffolds the folder, JS, CSS, and JSON schema files
3. Guides you through implementing the `decorate` function
4. Registers the component in `mappings.js`
5. Runs `npm run build:json`
6. Optionally validates on a running form via browser MCP (see below)

## Validation (optional)

After the component is built and registered, the skill can verify it loads correctly
on a running form. When prompted, provide a form URL where the component is in use:

> "Validate my custom component on http://localhost:3000/my-form"

The skill will navigate to that URL using browser MCP, inject `tools/validate-registration.js`,
and check three things:
1. **Form model loaded** -- is there a form on the page?
2. **Field using component** -- does any field's `:type` match the component name?
3. **DOM component loaded** -- does the field's DOM element have `componentStatus=loaded`?

This step requires Cursor with browser MCP (`cursor-ide-browser` or `cursor-browser-extension`).

## Compatibility

| Tool           | Supported | Notes                                         |
|----------------|-----------|-----------------------------------------------|
| Cursor         | Yes       | Full support including browser validation      |
| Claude Code    | Yes       | Knowledge + scaffold; no browser validation    |
| GitHub Copilot | Partial   | Manual skill reference; no browser MCP         |
