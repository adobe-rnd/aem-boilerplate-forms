# Custom component creation instructions.

**Rule Zero**: Never make assumptions. If something is unclear or unspecified in user prompt, ask clarifying questions and then proceed.


## Initial setup:

1. From the user prompt identify the *custom_component_name* and *base_type*. *base_type* can take value only from the array given below:
```
base_type = [
    'Button',
    'Checkbox',
    'Checkbox Group',
    'Date Input',
    'Drop Down',
    'Email',
    'File Input',
    'Image',
    'Number Input',
    'Panel',
    'Radio Group',
    'Reset Button',
    'Submit Button',
    'Telephone Input',
    'Text',
    'Text Input',
  ]
```

2. Run the scaffolder tool with *custom_component_name* and *base_type* as command line arguments. 

```sh
npm run create:custom-component -- --component-name={{custom_component_name}} --base-type={{base_type}}
```


