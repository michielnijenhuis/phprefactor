import { RefactorTool } from '../tools/refactor_tool'

export function castError(error: any): string {
    if (error instanceof Error) {
        return error.message
    }

    return String(error) || 'Unknown error'
}

export function formatNames(tools: RefactorTool[]): string {
    let name: string
    const names = tools.map((tool) => tool.name)
    if (names.length > 2) {
        const last = names.pop()
        name = names.join(', ') + ` and ${last}`
    } else {
        name = names.join(' and ')
    }

    return name
}
