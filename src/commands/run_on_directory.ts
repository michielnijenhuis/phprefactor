import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'

async function doRunOnDirectory(uri?: vscode.Uri, dryRun = false, only?: 'phpcsfixer' | 'rector') {
    const manager = PHPRefactorManager.getInstance()

    try {
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

        const promises: any[] = []
        if (!only || only === 'phpcsfixer') {
            promises.push(manager.runPHPCSFixerOnFile(directoryPath, dryRun))
        }
        if (!only || only === 'rector') {
            promises.push(manager.runRectorOnFile(directoryPath, dryRun))
        }

        await Promise.allSettled(promises)
    } catch (error) {
        // Error handling is done in the manager
    }
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
