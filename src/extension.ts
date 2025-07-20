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
    const manager = PHPRefactorManager.getInstance()

    const commands = {
        runOnFile,
        runPhpCsFixerOnFile,
        runRectorOnFile,
        dryRunOnFile,
        runOnDirectory,
        runPhpCsFixerOnDirectory,
        runRectorOnDirectory,
        dryRunOnDirectory,
        generateRectorConfig: async () => {
            await manager.generateConfigFromSettings(manager.rector)
        },
        generatePhpCsFixerConfig: async () => {
            await manager.generateConfigFromSettings(manager.phpcsfixer)
        },
        installRector: async () => {
            await manager.install(manager.rector)
        },
        installPhpCsFixer: async () => {
            await manager.install(manager.phpcsfixer)
        },
        checkInstallation: async () => {
            await Promise.all([
                manager.checkInstallation(manager.rector),
                manager.checkInstallation(manager.phpcsfixer),
            ])
        },
    }

    // Register commands
    for (const [command, callback] of Object.entries(commands)) {
        context.subscriptions.push(vscode.commands.registerCommand(`phprefactor.${command}`, callback))
    }

    // Refresh config when settings change
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('phprefactor')) {
            manager.refreshConfig()
        }
    })
}

export function deactivate() {}
