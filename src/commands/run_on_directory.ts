import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'
import { RefactorTool } from '../tools/refactor_tool'
import { runCommand } from './run_command'

async function doRunOnDirectory(uri?: vscode.Uri, dryRun: boolean = false, tools?: RefactorTool[]) {
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

    await runCommand(directoryPath, dryRun, tools)
}

export async function runOnDirectory(uri?: vscode.Uri) {
    await doRunOnDirectory(uri)
}

export async function runPhpCsFixerOnDirectory(uri?: vscode.Uri) {
    const manager = PHPRefactorManager.getInstance()
    await doRunOnDirectory(uri, false, [manager.phpcsfixer])
}

export async function runRectorOnDirectory(uri?: vscode.Uri) {
    const manager = PHPRefactorManager.getInstance()
    await doRunOnDirectory(uri, false, [manager.rector])
}

export async function dryRunOnDirectory(uri?: vscode.Uri) {
    await doRunOnDirectory(uri, true)
}
