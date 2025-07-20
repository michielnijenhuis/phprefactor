export function castError(error: any): string {
    if (error instanceof Error) {
        return error.message
    }

    return String(error) || 'Unknown error'
}
