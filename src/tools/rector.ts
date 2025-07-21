import { PHPRefactorConfig } from '../phprefactor'
import { realpath } from '../util'
import { RefactorTool, Result } from './refactor_tool'

export class Rector implements RefactorTool {
    public readonly name = 'Rector'
    public readonly key = 'rector'
    public readonly configName = 'rector.php'
    public readonly executable = 'vendor/bin/rector'
    public readonly installCommand = 'composer global require rector/rector'

    constructor(private readonly config: PHPRefactorConfig, private readonly rootPath: string | undefined) {
        //
    }

    generateConfig(): string {
        let phpSet = ''
        if (this.config.phpVersion) {
            const version = this.config.phpVersion.replace('.', '')
            if (Number(version) >= 80) {
                phpSet = `->withPhpSets(php${version}: true)\n`
            } else {
                phpSet = `->withPhp${version}Set()\n`
            }
        }

        const autoLoader = this.config.autoloadFile
            ? realpath(this.config.autoloadFile, this.rootPath || '')
            : undefined

        return `<?php

declare(strict_types=1);

use Rector\\Config\\RectorConfig;
use Rector\\Set\\ValueObject\\SetList;

$config = RectorConfig::configure()
    ->withPaths([
        ${this.config.paths.map((path) => (path === '__DIR__' ? '__DIR__' : `'${path}'`)).join(',\n        ')}
    ])
    ->withSkip([
        ${this.config.skip.map((path) => `'${path}'`).join(',\n        ')}
    ])
    ->withSets([
        SetList::DEAD_CODE,
        SetList::CODE_QUALITY,
        SetList::TYPE_DECLARATION,
        SetList::PRIVATIZATION,
        SetList::EARLY_RETURN,
        SetList::STRICT_BOOLEANS,
    ])
    ${phpSet}
;

if (file_exists('${autoLoader}')) {
    $config->withAutoloadPaths(['${autoLoader}']);
}

return $config;
`
    }

    getCommandArgs(target: string, configPath: string, dryRun: boolean): string[] {
        const args = ['process', target, '--config', configPath, '--no-progress-bar']
        if (dryRun) {
            args.push('--dry-run')
        }

        return args
    }

    supportsDryRun(): boolean {
        return true
    }

    mapResult(code: number | null, error: Error | null): Result<boolean> {
        if (error) {
            return { value: null, error }
        }

        return { value: code === 0, error: null }
    }
}
