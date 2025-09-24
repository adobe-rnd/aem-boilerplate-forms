# Your Project's Title...
Your project's description...

## Environments
- Preview: https://main--aem-boilerplate-forms--adobe-rnd.aem.page/
- Live: https://main--aem-boilerplate-forms--adobe-rnd.aem.live/

## Documentation
Before using the aem-boilerplate, we recommand you to go through the documentation on [www.aem.live](https://www.aem.live/docs/) and [experienceleague.adobe.com](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/authoring), more specifically:

- [Getting Started Guide](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/edge-dev-getting-started)
- [Creating Blocks](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/create-block)
- [Content Modelling](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/content-modeling)
- [Working with Tabular Data / Spreadsheets](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/wysiwyg-authoring/tabular-data)

Furthremore, we encourage you to watch the recordings of any of our previous presentations or sessions:
- [Getting started with AEM Forms Authoring and Edge Delivery Services](https://experienceleague.adobe.com/en/docs/events/experience-manager-gems-recordings/gems2024/edge-delivery-for-aem-forms)

## Prerequisites

- nodejs 18.3.x or newer
- AEM Cloud Service release 2024.8 or newer (>= `17465`)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template and add a mountpoint in the `fstab.yaml`
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)

## Custom Form Components

Create custom form components using the scaffolder tool with both interactive and programmatic modes:

### Interactive Mode

```sh
npm run create:custom-component
```

This will guide you through creating custom components with:
- **Simple Components**: Extend a single base component with custom styling and logic
- **Composite Components**: Combine multiple base components into one reusable component
- **Custom Display Names**: Set custom display names for each component in composite creation
- Automatic file generation (JS, CSS, JSON) and form integration

### Programmatic Mode

#### Simple Components
```sh
# Create a simple component extending a base component
node tools/forms-scaffolder.js --simple my-custom-input text-input
```

#### Composite Components

**Syntax:** `node tools/forms-scaffolder.js --composite component-name componentId1 componentId2 ...`
- **componentId**: OOTB component IDs (eg. text-input, checkbox, etc.)
    - `"componentId:Custom Name"` allows for custom names (overrides display names)
- _Note: Comma-separated format also supported: `"componentId1,componentId2"`_

```sh
# Original component names (space-separated)
node tools/forms-scaffolder.js --composite contact-form text-input email form-button

# Custom display names (quotes required for names with spaces)
node tools/forms-scaffolder.js --composite registration-form "text-input:Full Name" "email:Email Address" "form-button:Create Account"
```

_Comma-separated alternative:_
```sh
node tools/forms-scaffolder.js --composite contact-form "text-input,email,form-button"
node tools/forms-scaffolder.js --composite registration-form "text-input:Full Name,email:Email Address,form-button:Create Account"
```