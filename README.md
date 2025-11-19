# Template Processor

A TypeScript tool for Node.js that replaces mustache-style placeholders (`{{placeholder}}`) in template files with values from JSON configuration files.

## Features

- Processes mustache-style placeholders (`{{key}}` and `{{nested.key}}`)
- Supports JSONC (JSON with comments)
- Generates one output file per array element in the values file
- Validates placeholders before processing
- Command-line interface with helpful options
- TypeScript support with proper typing

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

## Usage

### Basic Usage

```bash
# Process templates using default files
node template-processor.js

# Or using ts-node for development
npm run dev
```

### Advanced Usage

```bash
# Specify custom files and output directory
node template-processor.js --template ./my-template.md --values ./my-values.json --output ./generated

# Validate placeholders without processing
node template-processor.js --validate

# Show help
node template-processor.js --help
```

### Command Line Options

- `--template, -t <path>`: Path to template file (default: `./privacy-policy--accounts-site.md`)
- `--values, -v <path>`: Path to values JSON file (default: `./terms-placeholder-values.jsonc`)
- `--output, -o <path>`: Output directory (default: `./output`)
- `--validate`: Validate placeholders without processing
- `--help, -h`: Show help message

## File Structure

Your project should have the following structure:
```
├── template-processor.ts       # Main TypeScript source
├── package.json               # Node.js dependencies
├── tsconfig.json              # TypeScript configuration
├── privacy-policy--accounts-site.md  # Template file with {{placeholders}}
├── terms-placeholder-values.jsonc    # JSON array with replacement values
└── output/                    # Generated files (created automatically)
```

## Template Format

Templates use mustache-style placeholders:
- Simple: `{{name}}`
- Nested: `{{email.privacy}}`, `{{url.apps.accounts}}`

## Values File Format

The values file should be a JSON array where each element represents one set of replacement values:

```json
[
  {
    "code": "GT",
    "name": "Company Name",
    "email": {
      "privacy": "privacy@company.com",
      "support": "support@company.com"
    },
    "url": {
      "site": "https://company.com",
      "apps": {
        "accounts": "https://accounts.company.com"
      }
    },
    "address": "123 Main St, City, State 12345"
  }
]
```

## Output

The tool generates one file per array element in the values file:
- Files are named: `privacy-policy-{code}.md` (using the 'code' field from JSON)
- If no 'code' field exists, falls back to: `privacy-policy-{sanitized-company-name}-{index}.md`
- All `{{placeholder}}` patterns are replaced with corresponding values
- Missing placeholders are warned about but don't stop processing

## Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Run with ts-node for development
- `npm start`: Run the compiled JavaScript version

### Example Output

```bash
$ node template-processor.js
Starting template processing...

Found placeholders in template:
  - {{name}}
  - {{email.privacy}}
  - {{email.support}}
  - {{url.apps.accounts}}
  - {{url.site}}
  - {{address}}

Processing templates...

✓ Generated: ./output/privacy-policy-gt.md
✓ Generated: ./output/privacy-policy-ct.md
✓ Generated: ./output/privacy-policy-act.md

Processed 3 template(s) successfully.
```