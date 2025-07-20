import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'
import { RefactorTool } from '../tools/refactor_tool'
import { castError } from '../util'

export async function runCommand(target: string, dryRun = false, tools?: RefactorTool[]) {
    const manager = PHPRefactorManager.getInstance()

    if (!tools) {
        tools = manager.orderedTools
    }

    let name: string
    const names = tools.map((tool) => tool.name)
    if (names.length > 2) {
        const last = names.pop()
        name = names.join(', ') + ` and ${last}`
    } else {
        name = names.join(' and ')
    }

    try {
        const results = await Promise.allSettled(tools.map((tool) => manager.runCommand(tool, target, dryRun)))
        const errors = results.map((result) => (result.status === 'fulfilled' ? null : castError(result.reason)))
        const success = errors.filter(Boolean).length === 0

        if (success && manager.openDiffAfterRun) {
            vscode.commands.executeCommand('git.openChange')
        }

        if (success && !manager.notifyOnResult) {
            return
        }

        if (success) {
            vscode.window.showInformationMessage(`${name} completed successfully.`)
        } else {
            const failedTools = tools.filter((_, i) => errors[i])
            const names = failedTools.map((tool) => tool.name)
            if (names.length > 2) {
                const last = names.pop()
                name = names.join(', ') + ` and ${last}`
            } else {
                name = names.join(' and ')
            }

            const messages = errors.filter(Boolean)
            vscode.window.showErrorMessage(`${name} failed with errors:\n${messages.join(',\n')}`)
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error running ${name}: ${castError(error)}`)
    }
}
