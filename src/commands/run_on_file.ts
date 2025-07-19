import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'

async function doRunOnFile(uri?: vscode.Uri, dryRun = false, only?: 'phpcsfixer' | 'rector') {
    const manager = PHPRefactorManager.getInstance()

    try {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
        if (!filePath) {
            vscode.window.showErrorMessage('No file selected')
            return
        }

        const promises: any[] = []
        if (!only || only === 'phpcsfixer') {
            promises.push(manager.runPHPCSFixerOnFile(filePath, dryRun))
        }
        if (!only || only === 'rector') {
            promises.push(manager.runRectorOnFile(filePath, dryRun))
        }

        await Promise.allSettled(promises)
    } catch (error) {
        // Error handling is done in the manager
    }
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
