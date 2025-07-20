import * as vscode from 'vscode'
import { RefactorTool } from '../phprefactor'
import { runCommand } from './run_command'

async function doRunOnFile(uri?: vscode.Uri, dryRun = false, only?: RefactorTool) {
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
    if (!filePath) {
        vscode.window.showErrorMessage('No file selected')
        return
    }

    await runCommand(filePath, dryRun, only)
}

export async function runOnFile(uri?: vscode.Uri) {
    await doRunOnFile(uri)
}

export async function runPhpCsFixerOnFile(uri?: vscode.Uri) {
    await doRunOnFile(uri, false, 'phpcsfixer')
}

export async function runRectorOnFile(uri?: vscode.Uri) {
    await doRunOnFile(uri, false, 'rector')
}

export async function dryRunOnFile(uri?: vscode.Uri) {
    await doRunOnFile(uri, true)
}
