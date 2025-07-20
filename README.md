# PHP Refactoring Extension

A VS Code extension that provides seamless integration with PHPCSFixer and [Rector](https://github.com/rectorphp/rector), the powerful PHP refactoring tool. This extension enables progressive refactoring of PHP codebases by allowing you to run PHPCSFixer Rector on individual files, directories, or entire workspaces directly from VS Code.

## Features

-   ✨ **Progressive Refactoring**: Run PHPCSFixer and/or Rector on specific files or directories instead of the entire codebase
-   🔧 **Intelligent Configuration**: Auto-generate config files from VS Code settings or use custom config files
-   📦 **Auto-Installation**: Install PHPCSFixer and/or Rector globally if not available
-   🎯 **Context Menu Integration**: Right-click on files and folders to run PHPCSFixer and/or Rector
-   🔍 **Dry Run Support**: Preview changes before applying them
-   📊 **Progress Tracking**: Visual progress indicators and detailed output logs
-   🔄 **Git Integration**: Automatically open diff view after refactoring

## Installation

1. Install the extension from the VS Code marketplace
2. The extension will activate automatically when you open a PHP file
3. If PHPCSFixer Rector is not installed, use the "Install PHPCSFixer|Rector Globally" command

## Commands

All commands are available through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

-   **phprefactor: Run on Current File** - Refactor the currently active PHP file
-   **phprefactor: Run PHPCSFixer on Current File** - Refactor the currently active PHP file (PHPCSFixer only)
-   **phprefactor: Run Rector on Current File** - Refactor the currently active PHP file (Rector only)
-   **phprefactor: Run on Directory** - Refactor all PHP files in a selected directory
-   **phprefactor: Run PHPCSFixer on Directory** - Refactor all PHP files in a selected directory (PHPCSFixer only)
-   **phprefactor: Run Rector on Directory** - Refactor all PHP files in a selected directory (Rector only)
-   **phprefactor: Run on Workspace** - Refactor the entire workspace
-   **phprefactor: Dry Run on Current File** - Preview changes for the current file
-   **phprefactor: Dry Run on Directory** - Preview changes for a directory
-   **phprefactor: Generate PHPCSFixer Config** - Create a phpcsfixer.php file from VS Code settings
-   **phprefactor: Generate Rector Config** - Create a rector.php file from VS Code settings
-   **phprefactor: Install PHPCSFixer Globally** - Install PHPCSFixer using Composer
-   **phprefactor: Install Rector Globally** - Install Rector using Composer
-   **phprefactor: Check Installation** - Verify PHPCSFixer and Rector installation and version

## Context Menu Integration

Right-click on any PHP file or folder in the Explorer to access Rector commands:

-   **Run phprefactor on Current File** (PHP files only)
-   **Run PHPCSFixer on Current File** (PHP files only)
-   **Run Rector on Current File** (PHP files only)
-   **Dry Run phprefactor on Current File** (PHP files only)
-   **Run phprefactor on Directory** (folders only)
-   **Run PHPCSFixer on Directory** (folders only)
-   **Run Rector on Directory** (folders only)
-   **Dry Run phprefactor on Directory** (folders only)

## Configuration

Configure the extension through VS Code settings (`File > Preferences > Settings` and search for "phprefactor"):

### Basic Settings

-   **`phprefactor.phpVersion`** (string): Target PHP version for refactoring. Options: `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `8.3`.
-   **`phprefactor.rector.executablePath`** (string): Path to Rector executable. Leave empty to use global installation.
-   **`phprefactor.rector.configPath`** (string): Path to custom Rector config file. Leave empty to auto-generate from settings.
-   **`phprefactor.phpcsfixer.executablePath`** (string): Path to PHPCSFixer executable. Leave empty to use global installation.
-   **`phprefactor.phpcsfixer.configPath`** (string): Path to custom PHPCSFixer config file. Leave empty to auto-generate from settings.

### Paths and Exclusions

-   **`phprefactor.paths`** (array): Default paths to scan when generating config. Default: `["__DIR____"]`
-   **`phprefactor.skip`** (array): Paths to skip during refactoring. Default: `["vendor"]`
-   **`phprefactor.autoloadFile`** (string): Path to autoload file. Default: `"vendor/autoload.php"`

### UI Settings

-   **`phprefactor.showProgressNotification`** (boolean): Show progress notification when running phprefactor. Default: `false`
-   **`phprefactor.notifyOnResult`** (boolean): Show information notification after running phprefactor. Default: `true`
-   **`phprefactor.openDiffAfterRun`** (boolean): Automatically open diff view after running phprefactor. Default: `true`

## Configuration Examples

### Example 1: Basic PHP 8.2 Upgrade

```json
{
    "phprefactor.phpVersion": "8.2",
    "phprefactor.paths": ["src", "app"],
    "phprefactor.skip": ["vendor", "tests/fixtures"]
}
```

### Example 2: Comprehensive Refactoring

```json
{
    "phprefactor.phpVersion": "8.3",
    "phprefactor.paths": ["src", "app", "lib"],
    "phprefactor.skip": ["vendor", "node_modules", "storage", "bootstrap/cache"]
}
```

### Example 3: Custom Rector Installation

```json
{
    "phprefactor.rector.executablePath": "/usr/local/bin/rector",
    "phprefactor.rector.configPath": "./custom-rector.php",
    "phprefactor.phpcsfixer.configPath": "./custom-phpcsfixer.php",
    "phprefactor.showProgressNotification": false,
    "phprefactor.openDiffAfterRun": false
}
```

## Generated Configuration

When you don't specify a custom config path, the extension will generate a `rector.php` and `phpcsfixer.php` file in your workspace root based on your VS Code settings. Here's an example of what gets generated:

```php
<?php

declare(strict_types=1);

use Rector\Config\RectorConfig;

$config = RectorConfig::configure()
    ->withPaths([
        'src',
        'app',
    ])
    ->withSkip([
        'vendor',
    ])
    ->withSets([
        SetList::DEAD_CODE,
        SetList::CODE_QUALITY,
        SetList::TYPE_DECLARATION,
        SetList::PRIVATIZATION,
        SetList::EARLY_RETURN,
        SetList::STRICT_BOOLEANS,
    ])
    ->withPhp74Set()
;

if (file_exists('vendor/autoload.php')) {
    $config->withAutoloadPaths(['vendor/autoload.php']);
}

return $config;
```

## Workflow Examples

### Progressive File Refactoring

1. Open a PHP file you want to refactor
2. Right-click in the editor and select "Dry Run on Current File"
3. Review the proposed changes in the output panel
4. If satisfied, run "Run on Current File"
5. Review the changes in the automatic diff view

### Directory-based Refactoring

1. Right-click on a directory in the Explorer
2. Select "Dry Run on Directory" to preview changes
3. Review the output and run "Run on Directory" to apply changes
4. Use Git to review and commit the changes

## Troubleshooting

### Common Issues

**Rector not found**

-   Ensure Rector is installed globally: `composer global require rector/rector`
-   Or specify the path in `phprefactor.rector.executablePath` setting
-   Use the "Install Rector Globally" command from the Command Palette

**PHPCSFixer not found**

-   Ensure PHPCSFixer is installed globally: `composer global require friendsofphp/php-cs-fixer`
-   Or specify the path in `phprefactor.phpcsfixer.executablePath` setting
-   Use the "Install PHPCSFixer Globally" command from the Command Palette

**Config file not found**

-   The extension will auto-generate a config file from your settings
-   Use "Generate Rector Config" and/or "Generate PHPCSFixer Config" command to create one manually
-   Specify a custom config path in `phprefactor.rector.configPath` and/or `phprefactor.phpcsfixer.configPath` setting

**Permission errors**

-   Ensure VS Code has write permissions to your workspace
-   Check that the PHP files are not read-only
-   Verify PHPCSFixer and Rector have permissions to modify files

**Autoload issues**

-   Ensure `vendor/autoload.php` exists and is correct
-   Update `phprefactor.autoloadFile` setting if using a different autoload file
-   Run `composer install` to generate autoload files

### Performance Tips

-   Use directory-specific refactoring instead of workspace-wide for large projects
-   Exclude unnecessary directories like `vendor`, `node_modules`, and `storage`
-   Use dry run first to preview changes before applying them
-   Consider running phprefactor on smaller batches of files for better control

### Debug Mode

To debug issues:

1. Open the Output panel (`View > Output`)
2. Select "phprefactor" from the dropdown
3. Run a phprefactor command to see detailed logs
4. Check for error messages and command output

## Integration with Other Tools

### Git Integration

The extension integrates with Git by:

-   Automatically opening diff view after refactoring (if enabled)
-   Preserving file history through Git tracking
-   Allowing easy rollback of changes

### Composer Integration

Works seamlessly with Composer projects:

-   Automatically detects `vendor/autoload.php`
-   Respects Composer's PSR-4 autoloading
-   Can install PHPCSFixer and Rector via Composer global

### PHP Development Workflow

Fits into your PHP development workflow:

1. Write code normally
2. Use phprefactor to modernize and improve code quality
3. Run tests to ensure functionality
4. Commit refactored code
5. Deploy with confidence

## Advanced Usage

### Custom Rules

For advanced users, you can create custom Rector rules and reference them in your config:

```php
<?php
// rector.php
use Rector\Config\RectorConfig;
use App\Rector\CustomRule;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->rule(CustomRule::class);
    // ... other configuration
};
```

### Multiple Configurations

You can maintain multiple Rector configurations for different purposes:

```json
{
    "rector.configPath": "./rector-upgrade.php" // For PHP version upgrades
}
```

```json
{
    "rector.configPath": "./rector-quality.php" // For code quality improvements
}
```

### Batch Processing

For large codebases, consider a phased approach:

1. **Phase 1**: Dead code removal
2. **Phase 2**: Code quality improvements
3. **Phase 3**: PHP version upgrades
4. **Phase 4**: Coding style fixes

## Contributing

This extension is open source. Contributions are welcome!

### Development Setup

1. Clone the repository
2. Run `npm install`
3. Open in VS Code
4. Press `F5` to run the extension in a new Extension Development Host window

### Building

-   `npm run compile` - Compile TypeScript
-   `npm run watch` - Watch for changes and compile automatically

## License

This extension is licensed under the MIT License.

## Changelog

### 1.0.0

-   Initial release
-   File and directory refactoring
-   Auto-configuration generation
-   Dry run support
-   Context menu integration
-   Progress notifications
-   Git integration

### 1.1.0

-   No longer open output panel on run

### 1.2.0

-   Add PHPCSFixer and Rector-only commands
-   Improve generated config files

### 1.3.0

-   Default `phprefactor.showProgressNotification` setting to `false`
-   Add `phprefactor.notifyOnResult` setting

## Support

If you encounter issues or have suggestions:

1. Check the output panel for error messages
2. Review the troubleshooting section
3. Submit an issue on the GitHub repository
4. Include relevant logs and configuration details

## Related Extensions

Consider these complementary extensions for PHP development:

-   **PHP Intelephense** - PHP language server
-   **PHP Debug** - Debug PHP applications
-   **PHP DocBlocker** - Generate DocBlocks
-   **GitLens** - Enhanced Git capabilities

---

**Happy refactoring!** 🚀
