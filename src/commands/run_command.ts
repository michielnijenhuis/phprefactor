import * as vscode from 'vscode'
import { PHPRefactorManager, RefactorTool, tools } from '../phprefactor'

export async function runCommand(target: string, dryRun = false, only?: RefactorTool) {
    const manager = PHPRefactorManager.getInstance()

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

    try {
        const promises: Promise<boolean>[] = []
        if (!only || only === 'phpcsfixer') {
            promises.push(manager.runPhpCsFixerCommand(target, dryRun))
        }
        if (!only || only === 'rector') {
            promises.push(manager.runRectorCommand(target, dryRun))
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
