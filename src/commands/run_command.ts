import * as vscode from 'vscode'
import { PHPRefactorManager } from '../phprefactor'
import { RefactorTool } from '../tools/refactor_tool'

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
        const errors: string[] = new Array(tools.length)

        for (let i = 0; i < tools.length; i++) {
            const tool = tools[i]

            try {
                await manager.runCommand(tool, target, dryRun)
            } catch (error) {
                const e = error instanceof Error ? error.message : String(error) || 'Unknown error'
                errors[i] = e
            }
        }

        const success = errors.filter(Boolean).length === 0
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
        vscode.window.showErrorMessage(
            `Error running ${name}: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`,
        )
    }
}
