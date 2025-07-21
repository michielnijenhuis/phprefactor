import { RefactorToolKey } from '../phprefactor'

export interface RefactorTool {
    readonly name: string
    readonly key: RefactorToolKey
    readonly executable: string
    readonly installCommand: string
    generateConfig(): string
    getCommandArgs(target: string, configPath: string, dryRun: boolean): string[]
    supportsDryRun(): boolean
}
