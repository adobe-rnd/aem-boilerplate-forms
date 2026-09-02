#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <component-name> <base-type>"
  echo ""
  echo "  component-name  kebab-case name (e.g. my-slider)"
  echo "  base-type       OOTB component to extend: text-input, number-input, drop-down,"
  echo "                  button, checkbox, radio-group, checkbox-group, panel, date-input,"
  echo "                  multiline-input, file-input, email, telephone-input"
  echo ""
  echo "Example: $0 my-slider number-input"
  exit 1
}

[ $# -lt 2 ] && usage

NAME="$1"
BASE="$2"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
COMP_DIR="$REPO_ROOT/blocks/form/components/$NAME"

if [ -d "$COMP_DIR" ]; then
  echo "Error: $COMP_DIR already exists"
  exit 1
fi

case "$BASE" in
  text-input)      RESOURCE_TYPE="core/fd/components/form/textinput/v1/textinput"; FIELD_TYPE="text-input" ;;
  number-input)    RESOURCE_TYPE="core/fd/components/form/numberinput/v1/numberinput"; FIELD_TYPE="number-input" ;;
  drop-down)       RESOURCE_TYPE="core/fd/components/form/dropdown/v1/dropdown"; FIELD_TYPE="drop-down" ;;
  button)          RESOURCE_TYPE="core/fd/components/form/button/v1/button"; FIELD_TYPE="button" ;;
  checkbox)        RESOURCE_TYPE="core/fd/components/form/checkbox/v1/checkbox"; FIELD_TYPE="checkbox" ;;
  radio-group)     RESOURCE_TYPE="core/fd/components/form/radiobutton/v1/radiobutton"; FIELD_TYPE="radio-group" ;;
  checkbox-group)  RESOURCE_TYPE="core/fd/components/form/checkboxgroup/v1/checkboxgroup"; FIELD_TYPE="checkbox-group" ;;
  panel)           RESOURCE_TYPE="core/fd/components/form/panelcontainer/v1/panelcontainer"; FIELD_TYPE="panel" ;;
  date-input)      RESOURCE_TYPE="core/fd/components/form/datepicker/v1/datepicker"; FIELD_TYPE="date-input" ;;
  multiline-input) RESOURCE_TYPE="core/fd/components/form/textinput/v1/textinput"; FIELD_TYPE="multiline-input" ;;
  file-input)      RESOURCE_TYPE="core/fd/components/form/fileinput/v1/fileinput"; FIELD_TYPE="file-input" ;;
  email)           RESOURCE_TYPE="core/fd/components/form/emailinput/v1/emailinput"; FIELD_TYPE="email" ;;
  telephone-input) RESOURCE_TYPE="core/fd/components/form/telephoneinput/v1/telephoneinput"; FIELD_TYPE="telephone-input" ;;
  *) echo "Error: Unknown base-type '$BASE'"; usage ;;
esac

TITLE=$(echo "$NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')

mkdir -p "$COMP_DIR"

if [ "$BASE" = "panel" ]; then
  cat > "$COMP_DIR/$NAME.js" << 'PANELEOF'
import { subscribe } from '../../rules/index.js';

export default function decorate(element, fd, container, formId) {
  subscribe(element, formId, (_element, model, eventType, payload) => {
    if (eventType === 'register') {
      // Find child models from the panel's items
      // const checkbox = model.items?.find((item) => item.fieldType === 'checkbox');
      // const textInput = model.items?.find((item) => item.fieldType === 'text-input');

      // Subscribe to child changes using their DOM wrapper elements.
      // Use [data-id="..."] selector to get the wrapper (not #id which targets the input).
      // if (checkbox) {
      //   const childWrapper = element.querySelector(`[data-id="${checkbox.id}"]`);
      //   subscribe(childWrapper, formId, (_el, _childModel, childEvent, childPayload) => {
      //     if (childEvent === 'register') {
      //       // child one-time setup
      //     } else if (childEvent === 'change') {
      //       childPayload?.changes?.forEach((change) => {
      //         if (change?.propertyName === 'value') {
      //           // react to child value change
      //         }
      //       });
      //     }
      //   }, { listenChanges: true });
      // }
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'properties') {
          // react to panel property changes
        }
      });
    }
  }, { listenChanges: true });

  return element;
}
PANELEOF
else
  cat > "$COMP_DIR/$NAME.js" << FIELDEOF
import { subscribe } from '../../rules/index.js';

export default function decorate(fieldDiv, fieldJson, container, formId) {
  let model = null;

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
    } else if (eventType === 'change') {
      payload?.changes?.forEach((change) => {
        if (change?.propertyName === 'value') {
          // React to value changes
        }
      });
    }
  }, { listenChanges: true });

  return fieldDiv;
}
FIELDEOF
fi

cat > "$COMP_DIR/$NAME.css" << CSSEOF
/* Styles for $NAME component */
CSSEOF

cat > "$COMP_DIR/_$NAME.json" << JSONEOF
{
  "definitions": [
    {
      "title": "$TITLE",
      "id": "$NAME",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "$RESOURCE_TYPE",
            "template": {
              "jcr:title": "$TITLE",
              "fieldType": "$FIELD_TYPE",
              "fd:viewType": "$NAME"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "$NAME",
      "fields": [
        {
          "component": "container",
          "name": "basic",
          "label": "Basic",
          "collapsible": false,
          "...": "../../models/form-common/_basic-fields.json"
        },
        {
          "...": "../../models/form-common/_help-container.json"
        }
      ]
    }
  ]
}
JSONEOF

echo "Scaffolded: $COMP_DIR"
echo "  $NAME.js   (decorate function with subscribe boilerplate)"
echo "  $NAME.css  (empty stylesheet)"
echo "  _$NAME.json (schema extending $BASE)"
echo ""
echo "Next steps:"
echo "  1. Add '$NAME' to customComponents in blocks/form/mappings.js"
echo "  2. Run: npm run build:json"
echo "  3. Implement your logic in $NAME.js"
