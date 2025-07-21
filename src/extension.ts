import { readFile } from 'fs/promises'
import * as vscode from 'vscode'
import { runOnDirectory } from './commands/run_on_directory'
import { runOnFile } from './commands/run_on_file'
import { PHPRefactorManager } from './phprefactor'
import { PhpCsFixer } from './tools/phpcsfixer'
import { PHPStan } from './tools/phpstan'
import { Rector } from './tools/rector'
import { castError, formatNames } from './util'

export function activate(context: vscode.ExtensionContext) {
    PHPRefactorManager.tools = [PHPStan, Rector, PhpCsFixer]

    const manager = PHPRefactorManager.getInstance()

    const commands: Record<string, (uri?: vscode.Uri) => Promise<void>> = {
        runOnFile,
        dryRunOnFile: async (uri?: vscode.Uri) => {
            await runOnFile(uri, true)
        },
        runOnDirectory,
        dryRunOnDirectory: async (uri?: vscode.Uri) => {
            await runOnDirectory(uri, true)
        },
        checkInstallation: async () => {
            const tools = manager.orderedTools
            const results = await Promise.allSettled(tools.map((tool) => manager.checkInstallation(tool)))
            const ok = results.filter((result) => result.status === 'fulfilled').length === results.length

            if (ok) {
                if (manager.notifyOnResult) {
                    vscode.window.showInformationMessage('All tools installed successfully.')
                }

                return
            }

            const failedTools = tools.filter((_, i) => results[i].status === 'rejected')
            vscode.window.showErrorMessage(`${formatNames(failedTools)} not installed successfully.`)
        },
        generateMissingConfigFiles: async function () {
            const results = await Promise.allSettled(
                manager.orderedTools.map((tool) => manager.generateConfigFromSettings(tool)),
            )
            const errors = results.map((result) => (result.status === 'fulfilled' ? null : castError(result.reason)))
            const success = errors.filter(Boolean).length === 0

            if (success) {
                if (manager.notifyOnResult) {
                    vscode.window.showInformationMessage('All missing configs generated successfully.')
                }

                return
            }

            const failedTools = manager.orderedTools.filter((_, i) => errors[i])
            vscode.window.showErrorMessage(`${formatNames(failedTools)} config not generated successfully.`)
        },
    }

    for (const tool of manager.orderedTools) {
        commands[`install${tool.name}`] = async function () {
            try {
                await manager.install(tool)

                if (manager.notifyOnResult) {
                    vscode.window.showInformationMessage(`${tool.name} installed successfully.`)
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error installing ${tool.name}:\n${castError(error)}`)
            }
        }
    }

    // Register commands
    for (const [command, callback] of Object.entries(commands)) {
        context.subscriptions.push(vscode.commands.registerCommand(`phprefactor.${command}`, callback))
    }

    // Run on save if enabled
    const disposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (manager.runOnSave && document.languageId === 'php') {
            await runOnFile(document.uri)
        }
    })
    context.subscriptions.push(disposable)

    // Register document formatting provider
    const provider = vscode.languages.registerDocumentFormattingEditProvider('php', {
        async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
            try {
                if (document.isDirty) {
                    await document.save()
                }

                await runOnFile(document.uri)

                const formattedContent = await readFile(document.fileName, 'utf8')

                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length),
                )

                return [vscode.TextEdit.replace(fullRange, formattedContent)]
            } catch (error) {
                vscode.window.showErrorMessage(`Formatting failed: ${castError(error)}`)

                return []
            }
        },
    })
    context.subscriptions.push(provider)

    // Refresh config when settings change
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('phprefactor')) {
            manager.refreshConfig()
        }
    })
}

export function deactivate() {}
