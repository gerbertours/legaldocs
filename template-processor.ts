#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface PlaceholderValues {
    code: string;
    name: string;
    email: {
        privacy: string;
        support: string;
    };
    url: {
        site: string;
        apps?: {
            accounts: string;
        };
    };
    address: string;
}

class TemplateProcessor {
    private templates: { path: string; content: string; name: string }[];
    private placeholderValues: PlaceholderValues[];

    constructor(templatePaths: string | string[], valuesPath: string) {
        const paths = Array.isArray(templatePaths) ? templatePaths : [templatePaths];
        this.templates = paths.map(templatePath => ({
            path: templatePath,
            content: this.loadTemplate(templatePath),
            name: path.basename(templatePath, path.extname(templatePath))
        }));
        this.placeholderValues = this.loadPlaceholderValues(valuesPath);
    }

    private loadTemplate(templatePath: string): string {
        try {
            return fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read template file: ${templatePath}. ${error}`);
        }
    }

    private loadPlaceholderValues(valuesPath: string): PlaceholderValues[] {
        try {
            const content = fs.readFileSync(valuesPath, 'utf8');
            // Only process comments if the file is actually JSONC (has comments)
            let cleanedContent = content;
            if (valuesPath.endsWith('.jsonc') && (content.includes('//') || content.includes('/*'))) {
                // More careful comment removal - only remove comments outside of strings
                cleanedContent = this.removeJSONComments(content);
            }
            return JSON.parse(cleanedContent);
        } catch (error) {
            throw new Error(`Failed to read or parse values file: ${valuesPath}. ${error}`);
        }
    }

    private removeJSONComments(content: string): string {
        let result = '';
        let inString = false;
        let inSingleLineComment = false;
        let inMultiLineComment = false;
        let escapeNext = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];
            
            if (escapeNext) {
                if (inString) result += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\' && inString) {
                escapeNext = true;
                result += char;
                continue;
            }
            
            if (char === '"' && !inSingleLineComment && !inMultiLineComment) {
                inString = !inString;
                result += char;
                continue;
            }
            
            if (!inString) {
                if (!inSingleLineComment && !inMultiLineComment) {
                    if (char === '/' && nextChar === '/') {
                        inSingleLineComment = true;
                        i++; // skip next character
                        continue;
                    }
                    if (char === '/' && nextChar === '*') {
                        inMultiLineComment = true;
                        i++; // skip next character
                        continue;
                    }
                }
                
                if (inSingleLineComment && (char === '\n' || char === '\r')) {
                    inSingleLineComment = false;
                    result += char;
                    continue;
                }
                
                if (inMultiLineComment && char === '*' && nextChar === '/') {
                    inMultiLineComment = false;
                    i++; // skip next character
                    continue;
                }
                
                if (!inSingleLineComment && !inMultiLineComment) {
                    result += char;
                }
            } else {
                result += char;
            }
        }
        
        return result;
    }

    private replacePlaceholders(template: string, values: PlaceholderValues): string {
        let result = template;

        // Replace nested object properties with dot notation
        const flattenedValues = this.flattenObject(values);

        // Replace all {{key}} patterns
        for (const [key, value] of Object.entries(flattenedValues)) {
            const placeholder = `{{${key}}}`;
            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            result = result.replace(regex, String(value));
        }

        return result;
    }

    private flattenObject(obj: any, prefix: string = ''): Record<string, any> {
        const flattened: Record<string, any> = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    Object.assign(flattened, this.flattenObject(obj[key], newKey));
                } else {
                    flattened[newKey] = obj[key];
                }
            }
        }

        return flattened;
    }

    private sanitizeFilename(name: string): string {
        // Remove or replace characters that are invalid in filenames
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    public processTemplates(outputDir: string = './output', filter?: string[]): void {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Filter placeholder values if filter is provided
        const filteredValues = filter ? 
            this.placeholderValues.filter(values => filter.includes(values.code)) : 
            this.placeholderValues;

        if (filteredValues.length === 0) {
            console.warn('No matching values found for the specified filter.');
            return;
        }

        let totalGenerated = 0;

        this.templates.forEach(template => {
            console.log(`\nProcessing template: ${template.name}`);
            
            filteredValues.forEach((values, index) => {
                try {
                    // Generate processed content
                    const processedContent = this.replacePlaceholders(template.content, values);

                    // Generate filename based on template name and code
                    const fileIdentifier = values.code ? 
                        this.sanitizeFilename(values.code) : 
                        this.sanitizeFilename(values.name || `template-${index + 1}`);
                    const outputPath = path.join(outputDir, `${template.name}-${fileIdentifier}.md`);

                    // Write processed content to file
                    fs.writeFileSync(outputPath, processedContent, 'utf8');

                    console.log(`  ✓ Generated: ${outputPath}`);
                    totalGenerated++;
                } catch (error) {
                    console.error(`  ✗ Failed to process template ${template.name} with values ${values.code || index + 1}:`, error);
                }
            });
        });

        console.log(`\nProcessed ${totalGenerated} file(s) successfully from ${this.templates.length} template(s) and ${filteredValues.length} value set(s).`);
    }

    public validatePlaceholders(filter?: string[]): void {
        const placeholderPattern = /\{\{([^}]+)\}\}/g;
        
        // Filter placeholder values if filter is provided
        const filteredValues = filter ? 
            this.placeholderValues.filter(values => filter.includes(values.code)) : 
            this.placeholderValues;

        this.templates.forEach(template => {
            console.log(`\nValidating template: ${template.name}`);
            const templatePlaceholders = new Set<string>();
            let match;
            
            // Reset regex lastIndex for each template
            placeholderPattern.lastIndex = 0;
            while ((match = placeholderPattern.exec(template.content)) !== null) {
                templatePlaceholders.add(match[1]);
            }

            console.log('Found placeholders:');
            templatePlaceholders.forEach(placeholder => {
                console.log(`  - {{${placeholder}}}`);
            });

            // Check if all placeholders have corresponding values
            filteredValues.forEach((values, index) => {
                const flattenedValues = this.flattenObject(values);
                const missingPlaceholders: string[] = [];

                templatePlaceholders.forEach(placeholder => {
                    if (!(placeholder in flattenedValues)) {
                        missingPlaceholders.push(placeholder);
                    }
                });

                if (missingPlaceholders.length > 0) {
                    console.warn(`\nWarning: Missing values for ${values.code || `entry ${index + 1}`}:`);
                    missingPlaceholders.forEach(placeholder => {
                        console.warn(`  - {{${placeholder}}}`);
                    });
                }
            });
        });
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Template Processor - Replace mustache placeholders in templates

Usage: node template-processor.js [options]

Options:
  --template, -t <path>    Path to template file(s) (default: ./privacy-policy--accounts-site.md)
                          Can specify multiple files: -t file1.md -t file2.md
                          Or use glob pattern: -t "*.md"
  --values, -v <path>      Path to values JSON file (default: ./terms-placeholder-values.jsonc)
  --output, -o <path>      Output directory (default: ./output)
  --filter, -f <codes>     Filter by company codes (comma-separated, e.g., GT,CT)
  --validate              Validate placeholders without processing
  --help, -h              Show this help message

Examples:
  node template-processor.js
  node template-processor.js --template "privacy-policy--*.md" --filter GT,CT
  node template-processor.js -t accounts.md -t marketing.md --values ./values.json
  node template-processor.js --validate --filter GT
        `);
        return;
    }

    const templatePaths = getMultipleArgValues(args, ['--template', '-t']) || ['./privacy-policy--accounts-site.md'];
    const valuesPath = getArgValue(args, ['--values', '-v']) || './terms-placeholder-values.jsonc';
    const outputDir = getArgValue(args, ['--output', '-o']) || './output';
    const filterArg = getArgValue(args, ['--filter', '-f']);
    const filter = filterArg ? filterArg.split(',').map(s => s.trim()) : undefined;
    const validateOnly = args.includes('--validate');

    try {
        // Expand glob patterns and resolve template paths
        const expandedPaths = expandTemplatePaths(templatePaths);
        
        if (expandedPaths.length === 0) {
            console.error('No template files found matching the specified patterns.');
            process.exit(1);
        }

        console.log(`Found ${expandedPaths.length} template file(s):`);
        expandedPaths.forEach(p => console.log(`  - ${p}`));

        const processor = new TemplateProcessor(expandedPaths, valuesPath);

        if (validateOnly) {
            processor.validatePlaceholders(filter);
        } else {
            console.log('\nStarting template processing...');
            processor.validatePlaceholders(filter);
            console.log('\nProcessing templates...');
            processor.processTemplates(outputDir, filter);
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

function getArgValue(args: string[], flags: string[]): string | undefined {
    for (const flag of flags) {
        const index = args.indexOf(flag);
        if (index !== -1 && index + 1 < args.length) {
            return args[index + 1];
        }
    }
    return undefined;
}

function getMultipleArgValues(args: string[], flags: string[]): string[] {
    const values: string[] = [];
    for (let i = 0; i < args.length - 1; i++) {
        if (flags.includes(args[i])) {
            values.push(args[i + 1]);
        }
    }
    return values;
}

function expandTemplatePaths(patterns: string[]): string[] {
    const expandedPaths: string[] = [];
    
    patterns.forEach(pattern => {
        if (pattern.includes('*')) {
            // Handle glob patterns - simple implementation
            const dir = path.dirname(pattern);
            const filePattern = path.basename(pattern);
            const actualDir = dir === '.' ? process.cwd() : dir;
            
            try {
                if (fs.existsSync(actualDir)) {
                    const files = fs.readdirSync(actualDir);
                    const regex = new RegExp('^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                    const matches = files.filter(file => regex.test(file));
                    expandedPaths.push(...matches.map(file => path.join(actualDir, file)));
                }
            } catch (error) {
                console.warn(`Error reading directory ${actualDir}: ${error}`);
            }
        } else {
            // Regular file path
            if (fs.existsSync(pattern)) {
                expandedPaths.push(path.resolve(pattern));
            } else {
                console.warn(`Template file not found: ${pattern}`);
            }
        }
    });
    
    return expandedPaths.filter((filePath, index, self) => self.indexOf(filePath) === index); // Remove duplicates
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

export { TemplateProcessor };