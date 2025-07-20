import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'
import { RefactorTool } from '../tools/refactor_tool'
import { runCommand } from './run_command'

async function doRunOnFile(uri?: vscode.Uri, dryRun = false, tools?: RefactorTool[]) {
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
    if (!filePath) {
        vscode.window.showErrorMessage('No file selected')
        return
    }

    await runCommand(filePath, dryRun, tools)
}

export async function runOnFile(uri?: vscode.Uri) {
    await doRunOnFile(uri)
}

export async function runPhpCsFixerOnFile(uri?: vscode.Uri) {
    const manager = PHPRefactorManager.getInstance()
    await doRunOnFile(uri, false, [manager.phpcsfixer])
}

export async function runRectorOnFile(uri?: vscode.Uri) {
    const manager = PHPRefactorManager.getInstance()
    await doRunOnFile(uri, false, [manager.rector])
}

export async function dryRunOnFile(uri?: vscode.Uri) {
    await doRunOnFile(uri, true)
}
