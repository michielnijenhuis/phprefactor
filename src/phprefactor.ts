import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import * as vscode from 'vscode'

const execAsync = promisify(exec)

type PHPVersion = '7.2' | '7.3' | '7.4' | '8.0' | '8.1' | '8.2' | '8.3'

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
    quiet: boolean
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

    public get isQuiet() {
        return this.config.quiet
    }

    private get rootPath() {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '.'
    }

    private loadConfig(): PHPRefactorConfig {
        const config = vscode.workspace.getConfiguration('phprefactor')
        const phpVersion = config.get<PHPVersion>('phpVersion')

        return {
            rector: {
                executablePath: config.get('rector.executablePath', 'vendor/bin/rector'),
                configPath: config.get('rector.configPath', ''),
            },
            phpcsfixer: {
                executablePath: config.get('phpcsfixer.executablePath', 'vendor/bin/php-cs-fixer'),
                configPath: config.get('phpcsfixer.configPath', ''),
            },
            paths: config.get('rector.paths', ['__DIR__']),
            skip: config.get('rector.skip', ['vendor']),
            quiet: config.get('rector.quiet', false),
            phpVersion: phpVersion,
            autoloadFile: config.get('autoloadFile', 'vendor/autoload.php'),
            showProgressNotification: config.get('showProgressNotification', true),
            openDiffAfterRun: config.get('rector.openDiffAfterRun', false),
        }
    }

    private async getRectorExecutable(): Promise<string> {
        let mayThrow = true
        if (!this.config.rector.executablePath || this.config.rector.executablePath === 'vendor/bin/rector') {
            mayThrow = false
            this.config.rector.executablePath = this.realpath('vendor/bin/rector')
        } else {
            this.config.rector.executablePath = this.realpath(this.config.rector.executablePath)
        }

        if (fs.existsSync(this.config.rector.executablePath)) {
            return this.config.rector.executablePath
        } else if (mayThrow) {
            throw new Error(`Rector executable not found at: ${this.config.rector.executablePath}`)
        }

        try {
            const { stdout } = await execAsync('which rector || where rector')
            return stdout.trim()
        } catch (error) {
            throw new Error('Rector not found. Please install it globally or specify the path in settings.')
        }
    }

    private async getPhpCsFixerExecutable(): Promise<string> {
        let mayThrow = true
        if (
            !this.config.phpcsfixer.executablePath ||
            this.config.phpcsfixer.executablePath === 'vendor/bin/php-cs-fixer'
        ) {
            mayThrow = false
            this.config.phpcsfixer.executablePath = this.realpath('vendor/bin/php-cs-fixer')
        } else {
            this.config.phpcsfixer.executablePath = this.realpath(this.config.phpcsfixer.executablePath)
        }

        if (fs.existsSync(this.config.phpcsfixer.executablePath)) {
            return this.config.phpcsfixer.executablePath
        } else if (mayThrow) {
            throw new Error(`PHPCSFixer executable not found at: ${this.config.phpcsfixer.executablePath}`)
        }

        try {
            const { stdout } = await execAsync('which phpcsfixer || where phpcsfixer')
            return stdout.trim()
        } catch (error) {
            throw new Error('PHPCSFixer not found. Please install it globally or specify the path in settings.')
        }
    }

    private async generateRectorConfigFile(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
            throw new Error('No workspace folder found')
        }

        const configPath = path.join(workspaceFolder.uri.fsPath, 'rector.php')
        this.config.rector.configPath = configPath

        if (fs.existsSync(configPath)) {
            return configPath
        }

        const phpSet = this.config.phpVersion ? `->withPhp${this.config.phpVersion.replace('.', '')}Set()\n` : ''

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

        fs.writeFileSync(configPath, configContent)
        return configPath
    }

    private async generatePhpCsFixerConfigFile(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
            throw new Error('No workspace folder found')
        }

        const configPath = path.join(workspaceFolder.uri.fsPath, 'phpcsfixer.php')
        this.config.phpcsfixer.configPath = configPath

        if (fs.existsSync(configPath)) {
            return configPath
        }

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
    ])
    ->setIndent('    ')
    ->setRiskyAllowed(true)
    ->setLineEnding("\\n")
    ->setFinder($finder)
;
`

        fs.writeFileSync(configPath, configContent)
        return configPath
    }

    private async getRectorConfigPath(): Promise<string> {
        if (this.config.rector.configPath && fs.existsSync(this.realpath(this.config.rector.configPath))) {
            return this.config.rector.configPath
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
            throw new Error('No workspace folder found')
        }

        const defaultConfigPath = path.join(workspaceFolder.uri.fsPath, 'rector.php')

        if (fs.existsSync(defaultConfigPath)) {
            return defaultConfigPath
        }

        // Generate config from settings
        return await this.generateRectorConfigFile()
    }

    private async getPhpCsFixer(): Promise<string> {
        if (this.config.phpcsfixer.configPath && fs.existsSync(this.realpath(this.config.phpcsfixer.configPath))) {
            return this.config.phpcsfixer.configPath
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
            throw new Error('No workspace folder found')
        }

        const defaultConfigPath = path.join(workspaceFolder.uri.fsPath, 'phpcsfixer.php')

        if (fs.existsSync(defaultConfigPath)) {
            return defaultConfigPath
        }

        // Generate config from settings
        return await this.generatePhpCsFixerConfigFile()
    }

    private async runRectorCommand(target: string, dryRun: boolean = false): Promise<boolean> {
        try {
            const executable = await this.getRectorExecutable()
            const configPath = await this.getRectorConfigPath()

            const args = ['process', target, '--config', configPath, '--no-progress-bar']

            if (dryRun) {
                args.push('--dry-run')
            }

            this.outputChannel.clear()
            this.outputChannel.appendLine(`Running Rector on: ${target}`)
            this.outputChannel.appendLine(`Config: ${configPath}`)
            this.outputChannel.appendLine(`Command: ${executable} ${args.join(' ')}`)
            this.outputChannel.appendLine('')

            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: dryRun ? 'Running Rector (Dry Run)' : 'Running Rector',
                cancellable: true,
            }

            if (this.config.showProgressNotification) {
                return await vscode.window.withProgress(progressOptions, async (progress, token) => {
                    return new Promise<boolean>((resolve, reject) => {
                        const process = spawn(executable, args, {
                            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
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
                                this.outputChannel.appendLine('\n✅ Rector completed successfully!')

                                if (!dryRun && this.config.openDiffAfterRun) {
                                    vscode.commands.executeCommand('git.openChange')
                                }

                                resolve(true)
                            } else {
                                this.outputChannel.appendLine(`\n❌ Rector failed with exit code: ${code}`)
                                reject(new Error(`Rector failed with exit code: ${code}`))
                            }
                        })

                        process.on('error', (error) => {
                            this.outputChannel.appendLine(`\n❌ Error running Rector: ${error.message}`)
                            reject(error)
                        })

                        token.onCancellationRequested(() => {
                            process.kill()
                            reject(new Error('Rector execution was cancelled'))
                        })
                    })
                })
            } else {
                return await new Promise<boolean>((resolve, reject) => {
                    const process = spawn(executable, args, {
                        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                    })

                    process.stdout.on('data', (data) => {
                        this.outputChannel.append(data.toString())
                    })

                    process.stderr.on('data', (data) => {
                        this.outputChannel.append(data.toString())
                    })

                    process.on('close', (code) => {
                        if (code === 0) {
                            this.outputChannel.appendLine('\n✅ Rector completed successfully!')
                            resolve(true)
                        } else {
                            this.outputChannel.appendLine(`\n❌ Rector failed with exit code: ${code}`)
                            reject(new Error(`Rector failed with exit code: ${code}`))
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

    private async runPhpCsFixerCommand(target: string, dryRun: boolean = false): Promise<boolean> {
        try {
            const executable = await this.getPhpCsFixerExecutable()
            const configPath = await this.getPhpCsFixer()

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

            this.outputChannel.clear()
            this.outputChannel.appendLine(`Running PHPCSFixer on: ${target}`)
            this.outputChannel.appendLine(`Config: ${configPath}`)
            this.outputChannel.appendLine(`Command: ${executable} ${args.join(' ')}`)
            this.outputChannel.appendLine('')

            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: dryRun ? 'Running PHPCSFixer (Dry Run)' : 'Running PHPCSFixer',
                cancellable: true,
            }

            if (this.config.showProgressNotification) {
                return await vscode.window.withProgress(progressOptions, async (progress, token) => {
                    return new Promise<boolean>((resolve, reject) => {
                        const process = spawn(executable, args, {
                            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
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
                                this.outputChannel.appendLine('\n✅ PHPCSFixer completed successfully!')

                                if (!dryRun && this.config.openDiffAfterRun) {
                                    vscode.commands.executeCommand('git.openChange')
                                }

                                resolve(true)
                            } else {
                                this.outputChannel.appendLine(`\n❌ PHPCSFixer failed with exit code: ${code}`)
                                reject(new Error(`PHPCSFixer failed with exit code: ${code}`))
                            }
                        })

                        process.on('error', (error) => {
                            this.outputChannel.appendLine(`\n❌ Error running PHPCSFixer: ${error.message}`)
                            reject(error)
                        })

                        token.onCancellationRequested(() => {
                            process.kill()
                            reject(new Error('PHPCSFixer execution was cancelled'))
                        })
                    })
                })
            } else {
                return await new Promise<boolean>((resolve, reject) => {
                    const process = spawn(executable, args, {
                        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                    })

                    process.stdout.on('data', (data) => {
                        this.outputChannel.append(data.toString())
                    })

                    process.stderr.on('data', (data) => {
                        this.outputChannel.append(data.toString())
                    })

                    process.on('close', (code) => {
                        if (code === 0) {
                            this.outputChannel.appendLine('\n✅ PHPCSFixer completed successfully!')
                            resolve(true)
                        } else {
                            this.outputChannel.appendLine(`\n❌ PHPCSFixer failed with exit code: ${code}`)
                            reject(new Error(`PHPCSFixer failed with exit code: ${code}`))
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

    async runRectorOnFile(filePath: string, dryRun: boolean = false): Promise<boolean> {
        return await this.runRectorCommand(filePath, dryRun)
    }

    async runPHPCSFixerOnFile(filePath: string, dryRun: boolean = false): Promise<boolean> {
        return await this.runPhpCsFixerCommand(filePath, dryRun)
    }

    async runRectorOnDirectory(directoryPath: string, dryRun: boolean = false): Promise<boolean> {
        return await this.runRectorCommand(directoryPath, dryRun)
    }

    async runPHPCSFixerOnDirectory(directoryPath: string, dryRun: boolean = false): Promise<boolean> {
        return await this.runPhpCsFixerCommand(directoryPath, dryRun)
    }

    async checkRectorInstallation(): Promise<boolean> {
        try {
            const executable = await this.getRectorExecutable()
            const { stdout } = await execAsync(`${executable} --version`)

            this.outputChannel.clear()
            this.outputChannel.appendLine('Rector Installation Check')
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

    async checkPhpCsFixerInstallation(): Promise<boolean> {
        try {
            const executable = await this.getPhpCsFixerExecutable()
            const { stdout } = await execAsync(`${executable} --version`)

            this.outputChannel.clear()
            this.outputChannel.appendLine('PHPCSFixer Installation Check')
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

    async installRector(): Promise<boolean> {
        try {
            this.outputChannel.clear()
            this.outputChannel.appendLine('Installing Rector globally...')

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Installing Rector',
                    cancellable: false,
                },
                async () => {
                    const { stdout, stderr } = await execAsync('composer global require rector/rector')
                    this.outputChannel.appendLine(stdout)
                    if (stderr) {
                        this.outputChannel.appendLine('STDERR:')
                        this.outputChannel.appendLine(stderr)
                    }
                },
            )

            this.outputChannel.appendLine('✅ Rector installed successfully!')
            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`❌ Installation failed: ${message}`)
            return false
        }
    }

    async installPhpCsFixer(): Promise<boolean> {
        try {
            this.outputChannel.clear()
            this.outputChannel.appendLine('Installing PHPCSFixer globally...')

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Installing PHPCsFixer',
                    cancellable: false,
                },
                async () => {
                    const { stdout, stderr } = await execAsync('composer global require friendsofphp/php-cs-fixer')
                    this.outputChannel.appendLine(stdout)
                    if (stderr) {
                        this.outputChannel.appendLine('STDERR:')
                        this.outputChannel.appendLine(stderr)
                    }
                },
            )

            this.outputChannel.appendLine('✅ PHPCSFixer installed successfully!')
            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`❌ Installation failed: ${message}`)
            return false
        }
    }

    async generateRectorConfigFromSettings(): Promise<boolean> {
        try {
            const configPath = await this.generateRectorConfigFile()
            this.outputChannel.clear()
            // this.outputChannel.show()
            this.outputChannel.appendLine(`Generated Rector config at: ${configPath}`)

            const doc = await vscode.workspace.openTextDocument(configPath)
            await vscode.window.showTextDocument(doc)

            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return false
        }
    }

    async generatePhpCsFixerConfigFromSettings(): Promise<boolean> {
        try {
            const configPath = await this.generatePhpCsFixerConfigFile()
            this.outputChannel.clear()
            // this.outputChannel.show()
            this.outputChannel.appendLine(`Generated PHPCSFixer config at: ${configPath}`)

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

        return path.resolve(this.rootPath, p)
    }
}
