import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'
import { RefactorTool } from '../tools/refactor_tool'
import { castError, formatNames } from '../util'

export async function runCommand(target: string, dryRun = false, tools?: RefactorTool[]) {
    const manager = PHPRefactorManager.getInstance()

    if (!tools) {
        tools = manager.orderedTools
    }

    if (dryRun) {
        tools = tools.filter((tool) => tool.supportsDryRun())
    }

    try {
        const start = performance.now()
        const results: PromiseSettledResult<void>[] = []

        for (const tool of tools) {
            const result = await Promise.allSettled([manager.runCommand(tool, target, dryRun)])
            results.push(...result)
        }

        const errors = results.map((result) => (result.status === 'fulfilled' ? null : castError(result.reason)))
        const success = errors.filter(Boolean).length === 0

        if (success && manager.openDiffAfterRun) {
            vscode.commands.executeCommand('git.openChange')
        }

        if (success && !manager.notifyOnResult) {
            return
        }

        if (success) {
            const end = performance.now()
            const duration = (end - start) / 1000
            vscode.window.showInformationMessage(
                `${manager.formattedNames} completed successfully in ${duration.toFixed(3)}s.`,
            )
        } else {
            const failedTools = tools.filter((_, i) => errors[i])
            const messages = errors.filter(Boolean)
            vscode.window.showErrorMessage(`${formatNames(failedTools)} failed with errors:\n${messages.join(',\n')}`)
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error running ${manager.formattedNames}: ${castError(error)}`)
    }
}
