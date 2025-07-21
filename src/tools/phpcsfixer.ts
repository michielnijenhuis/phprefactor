import { PHPRefactorConfig } from '../phprefactor'
import { RefactorTool } from './refactor_tool'

export class PhpCsFixer implements RefactorTool {
    public readonly name = 'PHPCSFixer'
    public readonly key = 'phpcsfixer'
    public readonly configName = 'phpcsfixer.php'
    public readonly executable = 'vendor/bin/php-cs-fixer'
    public readonly installCommand = 'composer global require friendsofphp/php-cs-fixer'

    constructor(private readonly config: PHPRefactorConfig) {}

    generateConfig(): string {
        return `<?php

$finder = (new PhpCsFixer\\Finder())
    ->in([
        ${this.config.paths.map((path) => (path === '__DIR__' ? '__DIR__' : `'${path}'`)).join(',\n        ')}
    ])
    ->exclude([
        ${this.config.skip.map((path) => `'${path}'`).join(',\n        ')}
    ])
;
        
return (new PhpCsFixer\\Config())
    ->setRules([
        '@PSR12' => true,
        '@PHP73Migration' => true, 
        '@PhpCsFixer' => true, 
        '@Symfony' => true, 
        'array_syntax' => ['syntax' => 'short'],
        'binary_operator_spaces' => ['default' => 'single_space'],
        'cast_spaces' => ['space' => 'single'],
        'control_structure_braces' => false,
        'control_structure_continuation_position' => ['position' => 'next_line'],
        'echo_tag_syntax' => ['format' => 'short'],
        'heredoc_to_nowdoc' => true,
        'no_multiline_whitespace_around_double_arrow' => true,
        'no_trailing_whitespace' => true,
        'no_unused_imports' => true,
        'single_quote' => true,
        'ternary_operator_spaces' => true,
        'trailing_comma_in_multiline' => ['elements' => ['arrays']],
        'whitespace_after_comma_in_array' => true,
        'no_alternative_syntax' => false,
        'blank_line_before_statement' => [
            'statements' => ['return', 'throw', 'try', 'foreach', 'for', 'while', 'if']
        ],
        'method_argument_space' => ['on_multiline' => 'ensure_fully_multiline'],
        'phpdoc_align' => ['align' => 'left'],
        'phpdoc_scalar' => true,
        'phpdoc_separation' => true,
        'phpdoc_trim' => true,
        'phpdoc_trim_consecutive_blank_line_separation' => true,
        'simplified_null_return' => false,
        'yoda_style' => false,
        'global_namespace_import' => [
            'import_classes' => true,
        ],
    ])
    ->setIndent('    ')
    ->setRiskyAllowed(true)
    ->setLineEnding("\\n")
    ->setFinder($finder)
;
`
    }

    getCommandArgs(target: string, configPath: string, dryRun: boolean): string[] {
        const args = [
            'fix',
            target,
            '--config',
            configPath,
            '--show-progress=none',
            '--allow-unsupported-php-version=yes',
        ]

        if (dryRun) {
            args.push('--dry-run')
        }

        return args
    }

    supportsDryRun(): boolean {
        return true
    }
}
