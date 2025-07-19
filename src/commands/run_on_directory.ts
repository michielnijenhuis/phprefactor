import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'

async function doRunOnDirectory(uri?: vscode.Uri, dryRun = false, only?: 'phpcsfixer' | 'rector') {
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

        const promises: Promise<boolean>[] = []
        if (!only || only === 'phpcsfixer') {
            promises.push(manager.runPHPCSFixerOnFile(directoryPath, dryRun))
        }
        if (!only || only === 'rector') {
            promises.push(manager.runRectorOnFile(directoryPath, dryRun))
        }

        const results = await Promise.allSettled(promises)

        if (!manager.isQuiet) {
            const success = results.every((result) => result.status === 'fulfilled' && result.value)

            if (success) {
                vscode.window.showInformationMessage(`${name} completed successfully.`)
            } else {
                const messages = results
                    .map((res) => (res.status === 'rejected' ? res.reason.message : ''))
                    .filter(Boolean)
                vscode.window.showErrorMessage(`${name} failed with errors:\n${messages.join(',\n')}`)
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `Error running ${name}: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`,
        )
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
