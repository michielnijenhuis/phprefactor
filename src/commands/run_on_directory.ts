import * as vscode from 'vscode'
import { RefactorTool, tools } from '../phprefactor'
import { runCommand } from './run_command'

async function doRunOnDirectory(uri?: vscode.Uri, dryRun = false, only?: RefactorTool) {
    let name: string
    if (only) {
        name = tools[only]
    } else {
        const names = Object.values(tools)
        if (names.length > 2) {
            const last = names.pop()
            name = names.join(', ') + ` and ${last}`
        } else {
            name = names.join(' and ')
        }
    }

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

    await runCommand(directoryPath, dryRun, only)
}

export async function runOnDirectory(uri?: vscode.Uri) {
    await doRunOnDirectory(uri)
}

export async function runPhpCsFixerOnDirectory(uri?: vscode.Uri) {
    await doRunOnDirectory(uri, false, 'phpcsfixer')
}

export async function runRectorOnDirectory(uri?: vscode.Uri) {
    await doRunOnDirectory(uri, false, 'rector')
}

export async function dryRunOnDirectory(uri?: vscode.Uri) {
    await doRunOnDirectory(uri, true)
}
