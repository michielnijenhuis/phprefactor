import { RefactorToolKey } from '../phprefactor'

export type Result<T = any> = { value: T; error: null } | { value: null; error: Error }

export interface RefactorTool<T = boolean> {
    readonly name: string
    readonly key: RefactorToolKey
    readonly configName: string
    readonly executable: string
    readonly installCommand: string
    generateConfig(): string
    getCommandArgs(target: string, configPath: string, dryRun: boolean): string[]
    supportsDryRun(): boolean
    mapResult(code: number | null, error: Error | null): Result<T>
}
