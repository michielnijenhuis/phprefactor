import { PHPRefactorConfig } from '../phprefactor'
import { RefactorTool } from './refactor_tool'

export class PHPStan implements RefactorTool {
    public readonly name = 'PHPStan'
    public readonly key = 'phpstan'
    public readonly executable = 'vendor/bin/phpstan'
    private readonly defaultInstallCommand = 'composer global require phpstan/phpstan'
    private readonly laravelInstallCommand = 'composer global require "larastan/larastan:^3.0"'

    constructor(private readonly config: PHPRefactorConfig) {
        //
    }

    get laravel(): boolean {
        return this.config.phpstan.laravel
    }

    get installCommand(): string {
        if (this.laravel) {
            return this.laravelInstallCommand
        }

        return this.defaultInstallCommand
    }

    generateConfig(): string {
        if (this.laravel) {
            return `includes:
- vendor/larastan/larastan/extension.neon
- vendor/nesbot/carbon/extension.neon

parameters:

paths:
    - app/

# Level 10 is the highest level
level: 8

treatPhpDocTypesAsCertain: false

#    ignoreErrors:
#        - '#PHPDoc tag @var#'
#
#    excludePaths:
#        - ./*/*/FileToBeExcluded.php            
`
        }

        return `parameters:

paths:
    - src/

# Level 10 is the highest level
level: 6

treatPhpDocTypesAsCertain: false

#    ignoreErrors:
#        - '#PHPDoc tag @var#'
#
#    excludePaths:
#        - ./*/*/FileToBeExcluded.php            
`
    }

    getCommandArgs(target: string, configPath: string): string[] {
        const args = ['analyse', '--fix', '--configuration', configPath, target]

        return args
    }

    supportsDryRun(): boolean {
        return false
    }
}
