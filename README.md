# Rector PHP Refactoring Extension

A VS Code extension that provides seamless integration with [Rector](https://github.com/rectorphp/rector), the powerful PHP refactoring tool. This extension enables progressive refactoring of PHP codebases by allowing you to run Rector on individual files, directories, or entire workspaces directly from VS Code.

## Features

✨ **Progressive Refactoring**: Run Rector on specific files or directories instead of the entire codebase
🔧 **Intelligent Configuration**: Auto-generate Rector config from VS Code settings or use custom config files
📦 **Auto-Installation**: Install Rector globally if not available
🎯 **Context Menu Integration**: Right-click on files and folders to run Rector
🔍 **Dry Run Support**: Preview changes before applying them
📊 **Progress Tracking**: Visual progress indicators and detailed output logs
🔄 **Git Integration**: Automatically open diff view after refactoring

## Installation

1. Install the extension from the VS Code marketplace
2. The extension will activate automatically when you open a PHP file
3. If Rector is not installed, use the "Install Rector Globally" command

## Commands

All commands are available through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **Rector: Run on Current File** - Refactor the currently active PHP file
- **Rector: Run on Directory** - Refactor all PHP files in a selected directory
- **Rector: Run on Workspace** - Refactor the entire workspace
- **Rector: Dry Run on Current File** - Preview changes for the current file
- **Rector: Dry Run on Directory** - Preview changes for a directory
- **Rector: Generate Rector Config** - Create a rector.php file from VS Code settings
- **Rector: Install Rector Globally** - Install Rector using Composer
- **Rector: Check Installation** - Verify Rector installation and version

## Context Menu Integration

Right-click on any PHP file or folder in the Explorer to access Rector commands:

- **Run Rector on Current File** (PHP files only)
- **Dry Run Rector on Current File** (PHP files only)
- **Run Rector on Directory** (folders only)
- **Dry Run Rector on Directory** (folders only)

## Configuration

Configure the extension through VS Code settings (`File > Preferences > Settings` and search for "rector"):

### Basic Settings

- **`rector.executablePath`** (string): Path to Rector executable. Leave empty to use global installation.
- **`rector.configPath`** (string): Path to custom Rector config file. Leave empty to auto-generate from settings.
- **`rector.phpVersion`** (string): Target PHP version for refactoring. Options: `7.4`, `8.0`, `8.1`, `8.2`, `8.3`. Default: `8.2`

### Rule Sets

- **`rector.sets`** (array): Rector rule sets to apply. Default: `["PHP_82"]`

Available sets:
- `PHP_74`, `PHP_80`, `PHP_81`, `PHP_82`, `PHP_83` - PHP version upgrades
- `DEAD_CODE` - Remove dead code
- `CODE_QUALITY` - Improve code quality
- `CODING_STYLE` - Apply coding standards
- `TYPE_DECLARATION` - Add type declarations
- `PRIVATIZATION` - Make methods/properties private when possible
- `NAMING` - Improve naming conventions
- `EARLY_RETURN` - Use early returns
- `INSTANCEOF` - Improve instanceof usage

### Paths and Exclusions

- **`rector.paths`** (array): Default paths to scan when generating config. Default: `["src"]`
- **`rector.skip`** (array): Paths to skip during refactoring. Default: `["vendor", "node_modules"]`
- **`rector.autoloadFile`** (string): Path to autoload file. Default: `"vendor/autoload.php"`

### UI Settings

- **`rector.showProgressNotification`** (boolean): Show progress notification when running Rector. Default: `true`
- **`rector.openDiffAfterRun`** (boolean): Automatically open diff view after running Rector. Default: `true`

## Configuration Examples

### Example 1: Basic PHP 8.2 Upgrade

```json
{
  "rector.phpVersion": "8.2",
  "rector.sets": ["PHP_82", "CODE_QUALITY", "DEAD_CODE"],
  "rector.paths": ["src", "app"],
  "rector.skip": ["vendor", "tests/fixtures"]
}
```

### Example 2: Comprehensive Refactoring

```json
{
  "rector.phpVersion": "8.3",
  "rector.sets": [
    "PHP_83",
    "CODE_QUALITY",
    "CODING_STYLE",
    "TYPE_DECLARATION",
    "PRIVATIZATION",
    "EARLY_RETURN",
    "DEAD_CODE"
  ],
  "rector.paths": ["src", "app", "lib"],
  "rector.skip": ["vendor", "node_modules", "storage", "bootstrap/cache"]
}
```

### Example 3: Custom Rector Installation

```json
{
  "rector.executablePath": "/usr/local/bin/rector",
  "rector.configPath": "./custom-rector.php",
  "rector.showProgressNotification": false,
  "rector.openDiffAfterRun": false
}
```

## Generated Configuration

When you don't specify a custom config path, the extension will generate a `rector.php` file in your workspace root based on your VS Code settings. Here's an example of what gets generated:

```php
<?php

declare(strict_types=1);

use Rector\Config\RectorConfig;
use Rector\Set\ValueObject\SetList;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->paths([
        'src',
        'app'
    ]);

    $rectorConfig->skip([
        'vendor',
        'node_modules'
    ]);

    $rectorConfig->sets([
        SetList::PHP_82,
        SetList::CODE_QUALITY,
        SetList::DEAD_CODE
    ]);

    $rectorConfig->phpVersion(82);

    if (file_exists('vendor/autoload.php')) {
        $rectorConfig->autoloadPaths(['vendor/autoload.php']);
    }
};
```

## Workflow Examples

### Progressive File Refactoring

1. Open a PHP file you want to refactor
2. Right-click in the editor and select "Dry Run Rector on Current File"
3. Review the proposed changes in the output panel
4. If satisfied, run "Run Rector on Current File"
5. Review the changes in the automatic diff view

### Directory-based Refactoring

1. Right-click on a directory in the Explorer
2. Select "Dry Run Rector on Directory" to preview changes
3. Review the output and run "Run Rector on Directory" to apply changes
4. Use Git to review and commit the changes

### Workspace-wide Refactoring

1. Use Command Palette: "Rector: Run on Workspace"
2. Monitor progress in the notification
3. Review changes across all files using Git diff

## Troubleshooting

### Common Issues

**Rector not found**
- Ensure Rector is installed globally: `composer global require rector/rector`
- Or specify the path in `rector.executablePath` setting
- Use the "Install Rector Globally" command from the Command Palette

**Config file not found**
- The extension will auto-generate a config file from your settings
- Use "Generate Rector Config" command to create one manually
- Specify a custom config path in `rector.configPath` setting

**Permission errors**
- Ensure VS Code has write permissions to your workspace
- Check that the PHP files are not read-only
- Verify Rector has permissions to modify files

**Autoload issues**
- Ensure `vendor/autoload.php` exists and is correct
- Update `rector.autoloadFile` setting if using a different autoload file
- Run `composer install` to generate autoload files

### Performance Tips

- Use directory-specific refactoring instead of workspace-wide for large projects
- Exclude unnecessary directories like `vendor`, `node_modules`, and `storage`
- Use dry run first to preview changes before applying them
- Consider running Rector on smaller batches of files for better control

### Debug Mode

To debug issues:

1. Open the Output panel (`View > Output`)
2. Select "Rector" from the dropdown
3. Run a Rector command to see detailed logs
4. Check for error messages and command output

## Integration with Other Tools

### Git Integration

The extension integrates with Git by:
- Automatically opening diff view after refactoring (if enabled)
- Preserving file history through Git tracking
- Allowing easy rollback of changes

### Composer Integration

Works seamlessly with Composer projects:
- Automatically detects `vendor/autoload.php`
- Respects Composer's PSR-4 autoloading
- Can install Rector via Composer global

### PHP Development Workflow

Fits into your PHP development workflow:
1. Write code normally
2. Use Rector to modernize and improve code quality
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

- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch for changes and compile automatically

## License

This extension is licensed under the MIT License.

## Changelog

### 1.0.0
- Initial release
- File and directory refactoring
- Auto-configuration generation
- Dry run support
- Context menu integration
- Progress notifications
- Git integration

## Support

If you encounter issues or have suggestions:

1. Check the output panel for error messages
2. Review the troubleshooting section
3. Submit an issue on the GitHub repository
4. Include relevant logs and configuration details

## Related Extensions

Consider these complementary extensions for PHP development:

- **PHP Intelephense** - PHP language server
- **PHP Debug** - Debug PHP applications
- **PHP DocBlocker** - Generate DocBlocks
- **GitLens** - Enhanced Git capabilities

---

**Happy refactoring!** 🚀