import * as vscode from 'vscode'
import { RefactorTool } from '../tools/refactor_tool'
import { runCommand } from './run_command'

export async function runOnFile(uri?: vscode.Uri, dryRun = false, tools?: RefactorTool[]) {
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
    if (!filePath) {
        vscode.window.showErrorMessage('No file selected')
        return
    }

    await runCommand(filePath, dryRun, tools)
}
