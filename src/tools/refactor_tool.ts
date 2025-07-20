import { RefactorToolKey } from '../phprefactor'

export abstract class RefactorTool {
    constructor(
        public readonly name: string,
        public readonly key: RefactorToolKey,
        public readonly executable: string,
        public readonly installCommand: string,
    ) {}

    abstract generateConfig(): Promise<string>

    abstract getCommandArgs(target: string, configPath: string, dryRun: boolean): string[]
}
