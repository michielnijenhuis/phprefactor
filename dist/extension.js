"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var import_child_process = require("child_process");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_util = require("util");
var vscode = __toESM(require("vscode"));
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var DEFAULT_PHP_VERSION = "8.2";
var PHPRefactorManager = class {
  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("PHPRefactor");
    this.config = this.loadConfig();
  }
  get rootPath() {
    return vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? ".";
  }
  loadConfig() {
    const config = vscode.workspace.getConfiguration("phprefactor");
    const phpVersion = config.get("phpVersion", DEFAULT_PHP_VERSION);
    return {
      rector: {
        executablePath: config.get("rector.executablePath", ""),
        configPath: config.get("rector.configPath", ""),
        paths: config.get("rector.paths", ["src"]),
        skip: config.get("rector.skip", ["vendor", "node_modules"]),
        showProgressNotification: config.get("rector.showProgressNotification", true),
        openDiffAfterRun: config.get("rector.openDiffAfterRun", true)
      },
      phpcsfixer: {
        executablePath: config.get("phpcsconfig.executablePath", `${this.rootPath}/vendor/bin/php-cs-fixer`),
        configPath: config.get("phpcsconfig.configPath", "")
      },
      phpVersion,
      autoloadFile: config.get("autoloadFile", "vendor/autoload.php")
    };
  }
  async getRectorExecutable() {
    let mayThrow = true;
    if (!this.config.rector.executablePath || this.config.rector.executablePath === "vendor/bin/rector") {
      mayThrow = false;
      this.config.rector.executablePath = `${this.rootPath}/vendor/bin/rector`;
    }
    if (fs.existsSync(this.config.rector.executablePath)) {
      return this.config.rector.executablePath;
    } else if (mayThrow) {
      throw new Error(`Rector executable not found at: ${this.config.rector.executablePath}`);
    }
    try {
      const { stdout } = await execAsync("which rector || where rector");
      return stdout.trim();
    } catch (error) {
      throw new Error("Rector not found. Please install it globally or specify the path in settings.");
    }
  }
  async generateRectorConfigFile() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }
    const configPath = path.join(workspaceFolder.uri.fsPath, "rector.php");
    this.config.rector.configPath = configPath;
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    const configContent = `<?php

declare(strict_types=1);

use Rector\\Config\\RectorConfig;

$config = RectorConfig::configure()
    ->withPaths([
        'src'
    ])
    ->withSkip([
        'vendor',
        'node_modules'
    ])
    ->withPreparedSets(
        deadCode: true,
        codeQuality: true,
        typeDeclarations: true,
        privatization: true,
        earlyReturn: true,
        strictBooleans: true,
    )
    ->withPhpSets(php${this.config.phpVersion.replace(".", "")}: true);

if (file_exists('vendor/autoload.php')) {
    $config->withAutoloadPaths(['vendor/autoload.php']);
}

return $config;
`;
    fs.writeFileSync(configPath, configContent);
    return configPath;
  }
  async getRectorConfigPath() {
    if (this.config.rector.configPath && fs.existsSync(this.config.rector.configPath)) {
      return this.config.rector.configPath;
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }
    const defaultConfigPath = path.join(workspaceFolder.uri.fsPath, "rector.php");
    if (fs.existsSync(defaultConfigPath)) {
      return defaultConfigPath;
    }
    return await this.generateRectorConfigFile();
  }
  async runRectorCommand(target, dryRun = false) {
    try {
      const executable = await this.getRectorExecutable();
      const configPath = await this.getRectorConfigPath();
      const args = ["process", target, "--config", configPath, "--no-progress-bar"];
      if (dryRun) {
        args.push("--dry-run");
      }
      this.outputChannel.clear();
      this.outputChannel.show();
      this.outputChannel.appendLine(`Running Rector on: ${target}`);
      this.outputChannel.appendLine(`Config: ${configPath}`);
      this.outputChannel.appendLine(`Command: ${executable} ${args.join(" ")}`);
      this.outputChannel.appendLine("");
      const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: dryRun ? "Running Rector (Dry Run)" : "Running Rector",
        cancellable: true
      };
      if (this.config.rector.showProgressNotification) {
        await vscode.window.withProgress(progressOptions, async (progress, token) => {
          return new Promise((resolve, reject) => {
            const process = (0, import_child_process.spawn)(executable, args, {
              cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });
            let output = "";
            let errorOutput = "";
            process.stdout.on("data", (data) => {
              const chunk = data.toString();
              output += chunk;
              this.outputChannel.append(chunk);
            });
            process.stderr.on("data", (data) => {
              const chunk = data.toString();
              errorOutput += chunk;
              this.outputChannel.append(chunk);
            });
            process.on("close", (code) => {
              if (code === 0) {
                this.outputChannel.appendLine("\n\u2705 Rector completed successfully!");
                if (!dryRun && this.config.rector.openDiffAfterRun) {
                  vscode.commands.executeCommand("git.openChange");
                }
                vscode.window.showInformationMessage("Rector completed successfully!");
                resolve();
              } else {
                this.outputChannel.appendLine(`
\u274C Rector failed with exit code: ${code}`);
                vscode.window.showErrorMessage(`Rector failed with exit code: ${code}`);
                reject(new Error(`Rector failed with exit code: ${code}`));
              }
            });
            process.on("error", (error) => {
              this.outputChannel.appendLine(`
\u274C Error running Rector: ${error.message}`);
              reject(error);
            });
            token.onCancellationRequested(() => {
              process.kill();
              reject(new Error("Rector execution was cancelled"));
            });
          });
        });
      } else {
        await new Promise((resolve, reject) => {
          const process = (0, import_child_process.spawn)(executable, args, {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
          });
          process.stdout.on("data", (data) => {
            this.outputChannel.append(data.toString());
          });
          process.stderr.on("data", (data) => {
            this.outputChannel.append(data.toString());
          });
          process.on("close", (code) => {
            if (code === 0) {
              this.outputChannel.appendLine("\n\u2705 Rector completed successfully!");
              resolve();
            } else {
              this.outputChannel.appendLine(`
\u274C Rector failed with exit code: ${code}`);
              reject(new Error(`Rector failed with exit code: ${code}`));
            }
          });
          process.on("error", (error) => {
            reject(error);
          });
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.outputChannel.appendLine(`
\u274C Error: ${message}`);
      vscode.window.showErrorMessage(`Rector error: ${message}`);
      throw error;
    }
  }
  async runOnFile(filePath, dryRun = false) {
    await this.runRectorCommand(filePath, dryRun);
  }
  async runOnDirectory(directoryPath, dryRun = false) {
    await this.runRectorCommand(directoryPath, dryRun);
  }
  async checkRectorInstallation() {
    try {
      const executable = await this.getRectorExecutable();
      const { stdout } = await execAsync(`${executable} --version`);
      this.outputChannel.clear();
      this.outputChannel.show();
      this.outputChannel.appendLine("Rector Installation Check");
      this.outputChannel.appendLine("========================");
      this.outputChannel.appendLine(`Executable: ${executable}`);
      this.outputChannel.appendLine(`Version: ${stdout.trim()}`);
      vscode.window.showInformationMessage(`Rector is installed: ${stdout.trim()}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.outputChannel.appendLine(`\u274C ${message}`);
      vscode.window.showErrorMessage(message);
      return false;
    }
  }
  async installRector() {
    try {
      this.outputChannel.clear();
      this.outputChannel.show();
      this.outputChannel.appendLine("Installing Rector globally...");
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Installing Rector",
          cancellable: false
        },
        async () => {
          const { stdout, stderr } = await execAsync("composer global require rector/rector");
          this.outputChannel.appendLine(stdout);
          if (stderr) {
            this.outputChannel.appendLine("STDERR:");
            this.outputChannel.appendLine(stderr);
          }
        }
      );
      this.outputChannel.appendLine("\u2705 Rector installed successfully!");
      vscode.window.showInformationMessage("Rector installed successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.outputChannel.appendLine(`\u274C Installation failed: ${message}`);
      vscode.window.showErrorMessage(`Rector installation failed: ${message}`);
    }
  }
  async generateRectorConfigFromSettings() {
    try {
      const rectorConfigPath = await this.generateRectorConfigFile();
      this.outputChannel.clear();
      this.outputChannel.show();
      this.outputChannel.appendLine(`Generated Rector config at: ${rectorConfigPath}`);
      const doc = await vscode.workspace.openTextDocument(rectorConfigPath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage("Rector config generated successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.showErrorMessage(`Failed to generate config: ${message}`);
    }
  }
};
function activate(context) {
  const manager = new PHPRefactorManager();
  context.subscriptions.push(
    vscode.commands.registerCommand("phprefactor.runOnFile", async (uri) => {
      try {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;
        if (!filePath) {
          vscode.window.showErrorMessage("No file selected");
          return;
        }
        await manager.runOnFile(filePath);
      } catch (error) {
      }
    }),
    // TODO: run rector on file
    // TODO: run phpcsfixer on file
    vscode.commands.registerCommand("phprefactor.runOnDirectory", async (uri) => {
      try {
        let directoryPath = uri?.fsPath;
        if (!directoryPath) {
          const selected = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Select Directory"
          });
          directoryPath = selected?.[0]?.fsPath;
        }
        if (!directoryPath) {
          vscode.window.showErrorMessage("No directory selected");
          return;
        }
        await manager.runOnDirectory(directoryPath);
      } catch (error) {
      }
    }),
    // TODO: run rector on dir
    // TODO: run phpcsfixer on dir
    vscode.commands.registerCommand("phprefactor.dryRunOnFile", async (uri) => {
      try {
        const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;
        if (!filePath) {
          vscode.window.showErrorMessage("No file selected");
          return;
        }
        await manager.runOnFile(filePath, true);
      } catch (error) {
      }
    }),
    // TODO: dry run rector on file
    // TODO: dry run phpcsfixer on file
    vscode.commands.registerCommand("phprefactor.dryRunOnDirectory", async (uri) => {
      try {
        let directoryPath = uri?.fsPath;
        if (!directoryPath) {
          const selected = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Select Directory"
          });
          directoryPath = selected?.[0]?.fsPath;
        }
        if (!directoryPath) {
          vscode.window.showErrorMessage("No directory selected");
          return;
        }
        await manager.runOnDirectory(directoryPath, true);
      } catch (error) {
      }
    }),
    // TODO: dry run rector on dir
    // TODO: dry run phpcsfixer on dir
    vscode.commands.registerCommand("phprefactor.generateRectorConfig", async () => {
      await manager.generateRectorConfigFromSettings();
    }),
    // TODO: generate phpcsfixer config
    vscode.commands.registerCommand("phprefactor.installRector", async () => {
      await manager.installRector();
    }),
    // TODO: install phpcsfixer
    vscode.commands.registerCommand("phprefactor.checkInstallation", async () => {
      await manager.checkRectorInstallation();
    })
  );
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("phprefactor")) {
      const newManager = new PHPRefactorManager();
      Object.assign(manager, newManager);
    }
  });
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
