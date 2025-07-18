import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import * as vscode from 'vscode'

const execAsync = promisify(exec)

type PHPVersion = '7.2' | '7.4' | '8.0' | '8.1' | '8.2' | '8.3'

interface RectorConfig {
    executablePath: string
    configPath: string
    paths: string[]
    skip: string[]
    showProgressNotification: boolean
    openDiffAfterRun: boolean
}

interface PHPCSFixerConfig {
    executablePath: string
    configPath: string
}

interface PHPRefactorConfig {
    rector: RectorConfig
    phpcsfixer: PHPCSFixerConfig
    phpVersion: PHPVersion
    autoloadFile: string
}

const DEFAULT_PHP_VERSION = '8.2'

class PHPRefactorManager {
    private config: PHPRefactorConfig
    private outputChannel: vscode.OutputChannel

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('PHPRefactor')
        this.config = this.loadConfig()
    }

    private get rootPath() {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '.'
    }

    private loadConfig(): PHPRefactorConfig {
        const config = vscode.workspace.getConfiguration('phprefactor')
        const phpVersion = config.get('phpVersion', DEFAULT_PHP_VERSION)

        return {
            rector: {
                executablePath: config.get('rector.executablePath', ''),
                configPath: config.get('rector.configPath', ''),
                paths: config.get('rector.paths', ['src']),
                skip: config.get('rector.skip', ['vendor', 'node_modules']),
                showProgressNotification: config.get('rector.showProgressNotification', true),
                openDiffAfterRun: config.get('rector.openDiffAfterRun', true),
            },
            phpcsfixer: {
                executablePath: config.get('phpcsconfig.executablePath', `${this.rootPath}/vendor/bin/php-cs-fixer`),
                configPath: config.get('phpcsconfig.configPath', ''),
            },
            phpVersion,
            autoloadFile: config.get('autoloadFile', 'vendor/autoload.php'),
        }
    }

    private async getRectorExecutable(): Promise<string> {
        let mayThrow = true
        if (!this.config.rector.executablePath || this.config.rector.executablePath === 'vendor/bin/rector') {
            mayThrow = false
            this.config.rector.executablePath = `${this.rootPath}/vendor/bin/rector`
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

        const configContent = `<?php

declare(strict_types=1);

use Rector\\Config\\RectorConfig;

$config = RectorConfig::configure()
    ->withPaths([
        'src'
    ])
    ->withSkip([
        'vendor',
        'node_modules'
    ])
    ->withPreparedSets(
        deadCode: true,
        codeQuality: true,
        typeDeclarations: true,
        privatization: true,
        earlyReturn: true,
        strictBooleans: true,
    )
    ->withPhpSets(php${this.config.phpVersion.replace('.', '')}: true);

if (file_exists('vendor/autoload.php')) {
    $config->withAutoloadPaths(['vendor/autoload.php']);
}

return $config;
`

        fs.writeFileSync(configPath, configContent)
        return configPath
    }

    private async getRectorConfigPath(): Promise<string> {
        if (this.config.rector.configPath && fs.existsSync(this.config.rector.configPath)) {
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

    private async runRectorCommand(target: string, dryRun: boolean = false): Promise<void> {
        try {
            const executable = await this.getRectorExecutable()
            const configPath = await this.getRectorConfigPath()

            const args = ['process', target, '--config', configPath, '--no-progress-bar']

            if (dryRun) {
                args.push('--dry-run')
            }

            this.outputChannel.clear()
            this.outputChannel.show()
            this.outputChannel.appendLine(`Running Rector on: ${target}`)
            this.outputChannel.appendLine(`Config: ${configPath}`)
            this.outputChannel.appendLine(`Command: ${executable} ${args.join(' ')}`)
            this.outputChannel.appendLine('')

            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: dryRun ? 'Running Rector (Dry Run)' : 'Running Rector',
                cancellable: true,
            }

            if (this.config.rector.showProgressNotification) {
                await vscode.window.withProgress(progressOptions, async (progress, token) => {
                    return new Promise<void>((resolve, reject) => {
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

                                if (!dryRun && this.config.rector.openDiffAfterRun) {
                                    vscode.commands.executeCommand('git.openChange')
                                }

                                vscode.window.showInformationMessage('Rector completed successfully!')
                                resolve()
                            } else {
                                this.outputChannel.appendLine(`\n❌ Rector failed with exit code: ${code}`)
                                vscode.window.showErrorMessage(`Rector failed with exit code: ${code}`)
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
                await new Promise<void>((resolve, reject) => {
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
                            resolve()
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
            vscode.window.showErrorMessage(`Rector error: ${message}`)
            throw error
        }
    }

    async runOnFile(filePath: string, dryRun: boolean = false): Promise<void> {
        await this.runRectorCommand(filePath, dryRun)
    }

    async runOnDirectory(directoryPath: string, dryRun: boolean = false): Promise<void> {
        await this.runRectorCommand(directoryPath, dryRun)
    }

    async checkRectorInstallation(): Promise<boolean> {
        try {
            const executable = await this.getRectorExecutable()
            const { stdout } = await execAsync(`${executable} --version`)

            this.outputChannel.clear()
            this.outputChannel.show()
            this.outputChannel.appendLine('Rector Installation Check')
            this.outputChannel.appendLine('========================')
            this.outputChannel.appendLine(`Executable: ${executable}`)
            this.outputChannel.appendLine(`Version: ${stdout.trim()}`)

            vscode.window.showInformationMessage(`Rector is installed: ${stdout.trim()}`)
            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`❌ ${message}`)
            vscode.window.showErrorMessage(message)
            return false
        }
    }

    async installRector(): Promise<void> {
        try {
            this.outputChannel.clear()
            this.outputChannel.show()
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
            vscode.window.showInformationMessage('Rector installed successfully!')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.outputChannel.appendLine(`❌ Installation failed: ${message}`)
            vscode.window.showErrorMessage(`Rector installation failed: ${message}`)
        }
    }

    async generateRectorConfigFromSettings(): Promise<void> {
        try {
            const rectorConfigPath = await this.generateRectorConfigFile()
            this.outputChannel.clear()
            this.outputChannel.show()
            this.outputChannel.appendLine(`Generated Rector config at: ${rectorConfigPath}`)

            const doc = await vscode.workspace.openTextDocument(rectorConfigPath)
            await vscode.window.showTextDocument(doc)

            vscode.window.showInformationMessage('Rector config generated successfully!')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            vscode.window.showErrorMessage(`Failed to generate config: ${message}`)
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    const manager = new PHPRefactorManager()

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('phprefactor.runOnFile', async (uri?: vscode.Uri) => {
            try {
                const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
                if (!filePath) {
                    vscode.window.showErrorMessage('No file selected')
                    return
                }
                await manager.runOnFile(filePath)
            } catch (error) {
                // Error handling is done in the manager
            }
        }),

        // TODO: run rector on file
        // TODO: run phpcsfixer on file

        vscode.commands.registerCommand('phprefactor.runOnDirectory', async (uri?: vscode.Uri) => {
            try {
                let directoryPath = uri?.fsPath

                if (!directoryPath) {
                    const selected = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Directory',
                    })
                    directoryPath = selected?.[0]?.fsPath
                }

                if (!directoryPath) {
                    vscode.window.showErrorMessage('No directory selected')
                    return
                }

                await manager.runOnDirectory(directoryPath)
            } catch (error) {
                // Error handling is done in the manager
            }
        }),

        // TODO: run rector on dir
        // TODO: run phpcsfixer on dir

        vscode.commands.registerCommand('phprefactor.dryRunOnFile', async (uri?: vscode.Uri) => {
            try {
                const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
                if (!filePath) {
                    vscode.window.showErrorMessage('No file selected')
                    return
                }
                await manager.runOnFile(filePath, true)
            } catch (error) {
                // Error handling is done in the manager
            }
        }),

        // TODO: dry run rector on file
        // TODO: dry run phpcsfixer on file

        vscode.commands.registerCommand('phprefactor.dryRunOnDirectory', async (uri?: vscode.Uri) => {
            try {
                let directoryPath = uri?.fsPath

                if (!directoryPath) {
                    const selected = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Directory',
                    })
                    directoryPath = selected?.[0]?.fsPath
                }

                if (!directoryPath) {
                    vscode.window.showErrorMessage('No directory selected')
                    return
                }

                await manager.runOnDirectory(directoryPath, true)
            } catch (error) {
                // Error handling is done in the manager
            }
        }),

        // TODO: dry run rector on dir
        // TODO: dry run phpcsfixer on dir

        vscode.commands.registerCommand('phprefactor.generateRectorConfig', async () => {
            await manager.generateRectorConfigFromSettings()
        }),

        // TODO: generate phpcsfixer config

        vscode.commands.registerCommand('phprefactor.installRector', async () => {
            await manager.installRector()
        }),

        // TODO: install phpcsfixer

        vscode.commands.registerCommand('phprefactor.checkInstallation', async () => {
            await manager.checkRectorInstallation()
            // TODO: check phpcsfixer installation
        }),
    )

    // Refresh config when settings change
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('phprefactor')) {
            // Reload config
            const newManager = new PHPRefactorManager()
            Object.assign(manager, newManager)
        }
    })
}

export function deactivate() {}
