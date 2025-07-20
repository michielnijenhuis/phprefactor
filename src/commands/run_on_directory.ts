import * as vscode from 'vscode'
import { RefactorTool } from '../tools/refactor_tool'
import { runCommand } from './run_command'

export async function runOnDirectory(uri?: vscode.Uri, dryRun: boolean = false, tools?: RefactorTool[]) {
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
