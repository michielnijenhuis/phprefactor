import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'

async function doRunOnFile(uri?: vscode.Uri, dryRun = false, only?: 'phpcsfixer' | 'rector') {
    const manager = PHPRefactorManager.getInstance()

    let name: string
    if (only === 'phpcsfixer') {
        name = 'PHPCSFixer'
    } else if (only === 'rector') {
        name = 'Rector'
    } else {
        name = 'Rector and PHPCSFixer'
    }

    try {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName
        if (!filePath) {
            vscode.window.showErrorMessage('No file selected')
            return
        }

        const promises: Promise<boolean>[] = []
        if (!only || only === 'phpcsfixer') {
            promises.push(manager.runPHPCSFixerOnFile(filePath, dryRun))
        }
        if (!only || only === 'rector') {
            promises.push(manager.runRectorOnFile(filePath, dryRun))
        }

        const results = await Promise.allSettled(promises)

        if (!manager.notifyOnResult) {
            return
        }

        const success = results.every((result) => result.status === 'fulfilled' && result.value)

        if (success) {
            vscode.window.showInformationMessage(`${name} completed successfully.`)
        } else {
            const messages = results.map((res) => (res.status === 'rejected' ? res.reason.message : '')).filter(Boolean)
            vscode.window.showErrorMessage(`${name} failed with errors:\n${messages.join(',\n')}`)
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `Error running ${name}: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`,
        )
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
