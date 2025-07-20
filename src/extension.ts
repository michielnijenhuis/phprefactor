import * as vscode from 'vscode'
import { runOnDirectory } from './commands/run_on_directory'
import { runOnFile } from './commands/run_on_file'
import { PHPRefactorManager } from './phprefactor'
import { PhpCsFixer } from './tools/phpcsfixer'
import { Rector } from './tools/rector'

export function activate(context: vscode.ExtensionContext) {
    PHPRefactorManager.tools = [PhpCsFixer, Rector]

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
            await Promise.all(manager.orderedTools.map((tool) => manager.checkInstallation(tool)))
        },
    }

    for (const tool of manager.orderedTools) {
        commands[`run${tool.name}onFile`] = async function (uri?: vscode.Uri) {
            await runOnFile(uri, false, [tool])
        }

        commands[`run${tool.name}onDirectory`] = async function (uri?: vscode.Uri) {
            await runOnDirectory(uri, false, [tool])
        }

        commands[`generate${tool.name}Config`] = async function () {
            await manager.generateConfigFromSettings(tool)
        }

        commands[`install${tool.name}`] = async function () {
            await manager.install(tool)
        }
    }

    // Register commands
    for (const [command, callback] of Object.entries(commands)) {
        context.subscriptions.push(vscode.commands.registerCommand(`phprefactor.${command}`, callback))
    }

    // Run on save if enabled
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (manager.runOnSave && document.languageId === 'php') {
            await runOnFile(document.uri)
        }
    })

    // Refresh config when settings change
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('phprefactor')) {
            manager.refreshConfig()
        }
    })
}

export function deactivate() {}
