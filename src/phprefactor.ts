import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import * as vscode from 'vscode'

const execAsync = promisify(exec)

type PHPVersion = '7.2' | '7.3' | '7.4' | '8.0' | '8.1' | '8.2' | '8.3'

export type RefactorTool = 'rector' | 'phpcsfixer'

export const tools: Record<RefactorTool, string> = {
    rector: 'Rector',
    phpcsfixer: 'PHPCSFixer',
}

interface RectorConfig {
    executablePath: string
    configPath: string
}

interface PHPCSFixerConfig {
    executablePath: string
    configPath: string
}

interface PHPRefactorConfig {
    phpVersion?: PHPVersion
    autoloadFile: string
    paths: string[]
    skip: string[]
    notifyOnResult: boolean
    showProgressNotification: boolean
    openDiffAfterRun: boolean
    rector: RectorConfig
    phpcsfixer: PHPCSFixerConfig
}

export class PHPRefactorManager {
    private static instance?: PHPRefactorManager

    private config: PHPRefactorConfig
    private outputChannel: vscode.OutputChannel

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('PHPRefactor')
        this.config = this.loadConfig()
    }

    public static getInstance(): PHPRefactorManager {
        if (!this.instance) {
            this.instance = new PHPRefactorManager()
        }

        return this.instance
    }

    public refreshConfig(): void {
        this.config = this.loadConfig()
        // regen config files?
    }

    public get notifyOnResult() {
        return this.config.notifyOnResult
    }

    private get rootPath() {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath
    }

    private loadConfig(): PHPRefactorConfig {
        const config = vscode.workspace.getConfiguration('phprefactor')

        return {
            rector: {
                executablePath: config.get('rector.executablePath', 'vendor/bin/rector'),
                configPath: config.get('rector.configPath', ''),
            },
            phpcsfixer: {
                executablePath: config.get('phpcsfixer.executablePath', 'vendor/bin/php-cs-fixer'),
                configPath: config.get('phpcsfixer.configPath', ''),
            },
            paths: config.get('paths', ['__DIR__']),
            skip: config.get('skip', ['vendor']),
            notifyOnResult: config.get('notifyOnResult', true),
            phpVersion: config.get<PHPVersion>('phpVersion'),
            autoloadFile: config.get('autoloadFile', 'vendor/autoload.php'),
            showProgressNotification: config.get('showProgressNotification', false),
            openDiffAfterRun: config.get('openDiffAfterRun', false),
        }
    }

    private async getExecutable(tool: RefactorTool, name?: string): Promise<string> {
        if (!name) {
            name = tool
        }

        let mayThrow = true
        if (!this.config[tool].executablePath || this.config[tool].executablePath === `vendor/bin/${name}`) {
            mayThrow = false
            this.config[tool].executablePath = this.realpath(`vendor/bin/${name}`)
        } else {
            this.config[tool].executablePath = this.realpath(this.config[tool].executablePath)
        }

        if (fs.existsSync(this.config[tool].executablePath)) {
            return this.config[tool].executablePath
        } else if (mayThrow) {
            throw new Error(`${tools[tool]} executable not found at: ${this.config[tool].executablePath}`)
        }

        try {
            const { stdout } = await execAsync(`which ${name} || where ${name}`)
            return stdout.trim()
        } catch (error) {
            throw new Error(`${tools[tool]} not found. Please install it globally or specify the path in settings.`)
        }
    }

    private async generateConfigFile(name: RefactorTool, content: string): Promise<string> {
        if (!this.rootPath) {
            throw new Error('No workspace folder found')
        }

        const configPath = path.join(this.rootPath, `${name}.php`)
        this.config[name].configPath = configPath

        if (fs.existsSync(configPath)) {
            return configPath
        }

        fs.writeFileSync(configPath, content)
        return configPath
    }

    private async generateRectorConfigFile(): Promise<string> {
        let phpSet = ''
        if (this.config.phpVersion) {
            const version = this.config.phpVersion.replace('.', '')
            if (Number(version) >= 80) {
                phpSet = `->withPhpSets(php${version}: true)\n`
            } else {
                phpSet = `->withPhp${version}Set()\n`
            }
        }

        const configContent = `<?php

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

if (file_exists('${this.config.autoloadFile}')) {
    $config->withAutoloadPaths(['${this.config.autoloadFile}']);
}

return $config;
`

        return await this.generateConfigFile('rector', configContent)
    }

    private async generatePhpCsFixerConfigFile(): Promise<string> {
        const configContent = `<?php

$finder = (new PhpCsFixer\\Finder())
    ->in([
        ${this.config.paths.map((path) => `'${path}'`).join(',\n        ')}
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
        return await this.generateConfigFile('phpcsfixer', configContent)
    }

    private async getConfigPath(name: RefactorTool): Promise<string> {
        if (this.config[name].configPath && fs.existsSync(this.realpath(this.config[name].configPath))) {
            return this.config[name].configPath
        }

        if (!this.rootPath) {
            throw new Error('No workspace folder found')
        }

        const defaultConfigPath = path.join(this.rootPath, name + '.php')

        if (fs.existsSync(defaultConfigPath)) {
            return defaultConfigPath
        }

        switch (name) {
            case 'rector':
                return await this.generateRectorConfigFile()
            case 'phpcsfixer':
                return await this.generatePhpCsFixerConfigFile()
            default:
                throw new TypeError(`Unsupported refactor tool: ${name}`)
        }
    }

    private async runCommand(
        tool: RefactorTool,
        args: string[],
        target: string,
        dryRun: boolean = false,
    ): Promise<boolean> {
        try {
            const executable = await this.getExecutable(tool)
            const configPath = await this.getConfigPath(tool)
            const name = tools[tool]

            this.outputChannel.clear()
            this.outputChannel.appendLine(`Running ${name} on: ${target}`)
            this.outputChannel.appendLine(`Config: ${configPath}`)
            this.outputChannel.appendLine(`Command: ${executable} ${args.join(' ')}`)
            this.outputChannel.appendLine('')

            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: dryRun ? `Running ${name} (Dry Run)` : `Running ${name}`,
                cancellable: true,
            }

            if (this.config.showProgressNotification) {
                return await vscode.window.withProgress(progressOptions, async (progress, token) => {
                    return new Promise<boolean>((resolve, reject) => {
                        const process = spawn(executable, args, {
                            cwd: this.rootPath,
                        })

                        let output = ''
                        let errorOutput = ''

                        process.stdout.on('data', (data) => {
                            const chunk = data.toString()
                            output += chunk
                            this.outputChannel.append(chunk)
                        })

                        process.stderr.on('data', (data) => {
                            const chunk = data.toString()
                            errorOutput += chunk
                            this.outputChannel.append(chunk)
                        })

                        process.on('close', (code) => {
                            if (code === 0) {
                                this.outputChannel.appendLine(`\n✅ ${name} completed successfully!`)

                                resolve(true)
                            } else {
                                this.outputChannel.appendLine(`\n❌ ${name} failed with exit code: ${code}`)
                                reject(new Error(`${name} failed with exit code: ${code}`))
                            }
                        })

                        process.on('error', (error) => {
                            this.outputChannel.appendLine(`\n❌ Error running ${name}: ${error.message}`)
                            reject(error)
                        })

                        token.onCancellationRequested(() => {
                            process.kill()
                            reject(new Error(`${name} execution was cancelled`))
                        })
                    })
                })
            } else {
                return await new Promise<boolean>((resolve, reject) => {
                    const process = spawn(executable, args, {
                        cwd: this.rootPath,
                    })

                    process.stdout.on('data', (data) => {
                        this.outputChannel.append(data.toString())
                    })

                    process.stderr.on('data', (data) => {
                        this.outputChannel.append(data.toString())
                    })

                    process.on('close', (code) => {
                        if (code === 0) {
                            this.outputChannel.appendLine(`\n✅ ${name} completed successfully!`)
                            resolve(true)
                        } else {
                            this.outputChannel.appendLine(`\n❌ ${name} failed with exit code: ${code}`)
                            reject(new Error(`${name} failed with exit code: ${code}`))
                        }
                    })

                    process.on('error', (error) => {
                        reject(error)
                    })
                })
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`\n❌ Error: ${message}`)
            throw error
        }
    }

    public async runRectorCommand(target: string, dryRun: boolean = false): Promise<boolean> {
        try {
            const configPath = await this.getConfigPath('rector')

            const args = ['process', target, '--config', configPath, '--no-progress-bar']
            if (dryRun) {
                args.push('--dry-run')
            }

            return await this.runCommand('rector', args, target, dryRun)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`\n❌ Error: ${message}`)
            throw error
        }
    }

    public async runPhpCsFixerCommand(target: string, dryRun: boolean = false): Promise<boolean> {
        try {
            const configPath = await this.getConfigPath('phpcsfixer')

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

            return await this.runCommand('phpcsfixer', args, target, dryRun)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`\n❌ Error: ${message}`)
            throw error
        }
    }

    async checkInstallation(tool: RefactorTool): Promise<boolean> {
        try {
            const executable = await this.getExecutable(tool)
            const { stdout } = await execAsync(`${executable} --version`)

            this.outputChannel.clear()
            this.outputChannel.appendLine(`${tools[tool]} Installation Check`)
            this.outputChannel.appendLine('========================')
            this.outputChannel.appendLine(`Executable: ${executable}`)
            this.outputChannel.appendLine(`Version: ${stdout.trim()}`)

            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`❌ ${message}`)
            return false
        }
    }

    async install(tool: RefactorTool, command: string): Promise<boolean> {
        try {
            this.outputChannel.clear()
            this.outputChannel.appendLine(`Installing ${tools[tool]} globally...`)

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Installing ${tools[tool]}`,
                    cancellable: false,
                },
                async () => {
                    // const { stdout, stderr } = await execAsync('composer global require rector/rector')
                    const { stdout, stderr } = await execAsync(command)
                    this.outputChannel.appendLine(stdout)
                    if (stderr) {
                        this.outputChannel.appendLine('STDERR:')
                        this.outputChannel.appendLine(stderr)
                    }
                },
            )

            this.outputChannel.appendLine(`✅ ${tools[tool]} installed successfully!`)
            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`❌ Installation failed: ${message}`)
            return false
        }
    }

    async generateConfigFromSettings(tool: RefactorTool): Promise<boolean> {
        try {
            let configPath: string
            switch (tool) {
                case 'rector':
                    configPath = await this.generateRectorConfigFile()
                    break
                case 'phpcsfixer':
                    configPath = await this.generatePhpCsFixerConfigFile()
                    break
                default:
                    throw new TypeError(`Unsupported refactor tool: ${tool}`)
            }

            this.outputChannel.clear()
            this.outputChannel.appendLine(`Generated ${tools[tool]} config at: ${configPath}`)

            const doc = await vscode.workspace.openTextDocument(configPath)
            await vscode.window.showTextDocument(doc)

            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return false
        }
    }

    private realpath(p: string, relative = true): string {
        if (!relative) {
            return path.resolve(p)
        }

        return path.resolve(this.rootPath ?? '.', p)
    }
}
