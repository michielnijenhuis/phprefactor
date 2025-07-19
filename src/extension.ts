import * as vscode from 'vscode'
import {
    dryRunOnDirectory,
    runOnDirectory,
    runPhpCsFixerOnDirectory,
    runRectorOnDirectory,
} from './commands/run_on_directory'
import { dryRunOnFile, runOnFile, runPhpCsFixerOnFile, runRectorOnFile } from './commands/run_on_file'
import { PHPRefactorManager } from './phprefactor'

export function activate(context: vscode.ExtensionContext) {
    const commands = {
        runOnFile,
        runPhpCsFixerOnFile,
        runRectorOnFile,
        dryRunOnFile,
        runOnDirectory,
        runPhpCsFixerOnDirectory,
        runRectorOnDirectory,
        dryRunOnDirectory,
    }

    // Register commands
    for (const [command, callback] of Object.entries(commands)) {
        context.subscriptions.push(vscode.commands.registerCommand(`phprefactor.${command}`, callback))
    }

    const manager = PHPRefactorManager.getInstance()

    context.subscriptions.push(
        vscode.commands.registerCommand('phprefactor.generateRectorConfig', async () => {
            await manager.generateRectorConfigFromSettings()
        }),

        vscode.commands.registerCommand('phprefactor.generatePhpCsFixerConfig', async () => {
            await manager.generatePhpCsFixerConfigFromSettings()
        }),

        vscode.commands.registerCommand('phprefactor.installRector', async () => {
            await manager.installRector()
        }),

        vscode.commands.registerCommand('phprefactor.installPhpCsFixer', async () => {
            await manager.installPhpCsFixer()
        }),

        vscode.commands.registerCommand('phprefactor.checkInstallation', async () => {
            await manager.checkRectorInstallation()
            await manager.checkPhpCsFixerInstallation()
        }),
    )

    // Refresh config when settings change
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('phprefactor')) {
            manager.refreshConfig()
        }
    })
}

export function deactivate() {}
