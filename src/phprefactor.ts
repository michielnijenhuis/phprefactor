import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import * as vscode from 'vscode'
import { RefactorTool } from './tools/refactor_tool'
import { formatNames, realpath } from './util'

const execAsync = promisify(exec)

type PHPVersion = '7.2' | '7.3' | '7.4' | '8.0' | '8.1' | '8.2' | '8.3'

export type RefactorToolKey = 'rector' | 'phpcsfixer' | 'phpstan'

interface RefactorToolConfig {
    enabled: boolean
    priority: number
    executablePath: string
    configPath: string
}

interface RectorConfig extends RefactorToolConfig {
    //
}

interface PHPCSFixerConfig extends RefactorToolConfig {
    //
}

interface PHPStanConfig extends RefactorToolConfig {
    laravel: boolean
}

export interface PHPRefactorConfig {
    phpVersion?: PHPVersion
    runOnSave: boolean
    autoloadFile: string
    paths: string[]
    skip: string[]
    notifyOnResult: boolean
    showProgressNotification: boolean
    openDiffAfterRun: boolean

    // tools
    rector: RectorConfig
    phpcsfixer: PHPCSFixerConfig
    phpstan: PHPStanConfig
}

type RefactorToolConstructor = new (config: PHPRefactorConfig, root: string | undefined) => RefactorTool

export class PHPRefactorManager {
    public static tools: RefactorToolConstructor[] = []
    private static instance?: PHPRefactorManager

    public readonly tools: Record<RefactorToolKey, RefactorTool>
    private readonly _orderedTools: RefactorTool[]

    private config: PHPRefactorConfig
    private outputChannel: vscode.OutputChannel

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('PHPRefactor')
        this.config = this.loadConfig()

        this.tools = PHPRefactorManager.tools.reduce((acc, tool) => {
            const instance = new tool(this.config, this.rootPath)
            acc[instance.key] = instance

            return acc
        }, {} as Record<RefactorToolKey, RefactorTool>)

        this._orderedTools = Object.values(this.tools).sort(
            (a, b) => this.config[b.key].priority - this.config[a.key].priority,
        )
    }

    public static getInstance(): PHPRefactorManager {
        if (!this.instance) {
            this.instance = new PHPRefactorManager()
        }

        return this.instance
    }

    public get rector(): RefactorTool {
        return this.tools.rector
    }

    public get phpcsfixer(): RefactorTool {
        return this.tools.phpcsfixer
    }

    public get phpstan(): RefactorTool {
        return this.tools.phpstan
    }

    public get orderedTools(): RefactorTool[] {
        return this._orderedTools.filter((tool) => this.config[tool.key].enabled)
    }

    public get formattedNames(): string {
        return formatNames(this.orderedTools)
    }

    public get openDiffAfterRun() {
        return this.config.openDiffAfterRun
    }

    public get notifyOnResult() {
        return this.config.notifyOnResult
    }

    public get runOnSave() {
        return this.config.runOnSave
    }

    public get rootPath() {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath
    }

    public async runCommand(tool: RefactorTool, target: string, dryRun: boolean = false): Promise<void> {
        const executable = await this.getExecutable(tool)
        const configPath = await this.getConfigPath(tool)
        const name = tool.name
        const args = tool.getCommandArgs(target, configPath, dryRun)

        this.outputChannel.appendLine(`Running ${name} on: ${target}`)
        this.outputChannel.appendLine(`Config: ${configPath}`)
        this.outputChannel.appendLine(`Command: ${executable} ${args.join(' ')}`)
        this.outputChannel.appendLine('')

        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: dryRun ? `Running ${name} (Dry Run)` : `Running ${name}`,
            cancellable: true,
        }

        if (!this.config.showProgressNotification) {
            return await this.doRunCommand(tool, executable, args)
        }

        return await vscode.window.withProgress(progressOptions, async (_progress, token) => {
            return this.doRunCommand(tool, executable, args, token)
        })
    }

    private async doRunCommand(
        tool: RefactorTool,
        executable: string,
        args: string[],
        token?: vscode.CancellationToken,
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const name = tool.name

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
                const result = tool.mapResult(code, null)
                let icon: string

                if (!result.value) {
                    reject(result.error || new Error('Unknown error'))
                    icon = '❌'
                } else {
                    resolve()
                    icon = '✅'
                }

                if (code !== null) {
                    this.outputChannel.appendLine(`\n${icon} ${name} exited with code: ${code}`)
                }
            })

            process.on('error', (error) => {
                const result = tool.mapResult(null, error)

                if (!result.value) {
                    this.outputChannel.appendLine(`\n❌ Error running ${name}: ${error.message}`)
                    reject(result.error)
                } else {
                    resolve()
                }
            })

            token?.onCancellationRequested(() => {
                process.kill()
                reject(new Error(`${name} execution was cancelled`))
            })
        })
    }

    async checkInstallation(tool: RefactorTool): Promise<void> {
        const executable = await this.getExecutable(tool)
        const { stdout } = await execAsync(`${executable} --version`)

        this.outputChannel.appendLine(`${tool.name} Installation Check`)
        this.outputChannel.appendLine('========================')
        this.outputChannel.appendLine(`Executable: ${executable}`)
        this.outputChannel.appendLine(`Version: ${stdout.trim()}`)
    }

    async install(tool: RefactorTool): Promise<void> {
        this.outputChannel.appendLine(`Installing ${tool.name} globally...`)

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${tool.name}`,
                cancellable: false,
            },
            async () => {
                const { stdout, stderr } = await execAsync(tool.installCommand)
                this.outputChannel.appendLine(stdout)
                if (stderr) {
                    this.outputChannel.appendLine('STDERR:')
                    this.outputChannel.appendLine(stderr)
                }
            },
        )
    }

    async generateConfigFromSettings(tool: RefactorTool): Promise<void> {
        const configPath: string = await this.generateConfigFile(tool)
        this.outputChannel.appendLine(`Generated ${tool.name} config at: ${configPath}`)

        const doc = await vscode.workspace.openTextDocument(configPath)
        await vscode.window.showTextDocument(doc)
    }

    public refreshConfig(): void {
        this.config = this.loadConfig()
    }

    private loadConfig(): PHPRefactorConfig {
        const config = vscode.workspace.getConfiguration('phprefactor')

        return {
            rector: {
                enabled: config.get('rector.enabled', true),
                executablePath: config.get('rector.executablePath', 'vendor/bin/rector'),
                configPath: config.get('rector.configPath', ''),
                priority: config.get('rector.priority', 20),
            },
            phpcsfixer: {
                enabled: config.get('phpcsfixer.enabled', true),
                executablePath: config.get('phpcsfixer.executablePath', 'vendor/bin/php-cs-fixer'),
                configPath: config.get('phpcsfixer.configPath', ''),
                priority: config.get('phpcsfixer.priority', 10),
            },
            phpstan: {
                enabled: config.get('phpstan.enabled', true),
                executablePath: config.get('phpstan.executablePath', 'vendor/bin/phpstan'),
                configPath: config.get('phpstan.configPath', ''),
                priority: config.get('phpstan.priority', 30),
                laravel: config.get('phpstan.laravel', false),
            },
            paths: config.get('paths', ['__DIR__']),
            skip: config.get('skip', ['vendor']),
            notifyOnResult: config.get('notifyOnResult', true),
            phpVersion: config.get<PHPVersion>('phpVersion'),
            runOnSave: config.get('runOnSave', false),
            autoloadFile: config.get('autoloadFile', 'vendor/autoload.php'),
            showProgressNotification: config.get('showProgressNotification', false),
            openDiffAfterRun: config.get('openDiffAfterRun', false),
        }
    }

    private async getExecutable(tool: RefactorTool): Promise<string> {
        const key = tool.key
        const name = tool.name

        let mayThrow = true
        if (!this.config[key].executablePath || this.config[key].executablePath === `vendor/bin/${name}`) {
            mayThrow = false
            this.config[key].executablePath = realpath(`vendor/bin/${name}`, this.rootPath)
        } else {
            this.config[key].executablePath = realpath(this.config[key].executablePath, this.rootPath)
        }

        if (fs.existsSync(this.config[key].executablePath)) {
            return this.config[key].executablePath
        } else if (mayThrow) {
            throw new Error(`${tool.name} executable not found at: ${this.config[key].executablePath}`)
        }

        try {
            const { stdout } = await execAsync(`which ${name} || where ${name}`)
            return stdout.trim()
        } catch (error) {
            throw new Error(`${tool.name} not found. Please install it globally or specify the path in settings.`)
        }
    }

    private async generateConfigFile(tool: RefactorTool): Promise<string> {
        if (!this.rootPath) {
            throw new Error('No workspace folder found')
        }

        const configPath = path.join(this.rootPath, tool.configName)
        this.config[tool.key].configPath = configPath

        if (fs.existsSync(configPath)) {
            return configPath
        }

        fs.writeFileSync(configPath, tool.generateConfig())

        return configPath
    }

    private async getConfigPath(tool: RefactorTool): Promise<string> {
        if (
            this.config[tool.key].configPath &&
            fs.existsSync(realpath(this.config[tool.key].configPath, this.rootPath))
        ) {
            return this.config[tool.key].configPath
        }

        if (!this.rootPath) {
            throw new Error('No workspace folder found')
        }

        const defaultConfigPath = path.join(this.rootPath, tool.configName)

        if (fs.existsSync(defaultConfigPath)) {
            return defaultConfigPath
        }

        return await this.generateConfigFile(tool)
    }
}
