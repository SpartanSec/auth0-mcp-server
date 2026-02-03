import chalk from 'chalk';
import { keychain } from '../utils/keychain.js';
import { cliOutput } from '../utils/terminal.js';
import { log } from '../utils/logger.js';
import { claudeApi } from '../utils/claude-api.js';

/**
 * Command options for the config command
 */
export type ConfigOptions = {
  claudeApiKey?: string;
};

/**
 * Configures the Auth0 MCP server settings
 *
 * @param {ConfigOptions} options - Configuration options
 * @returns A promise that resolves when configuration is complete
 */
async function config(options: ConfigOptions): Promise<void> {
  try {
    if (options.claudeApiKey) {
      log('Setting Claude API key');

      // Validate API key format (basic check)
      if (!options.claudeApiKey.startsWith('sk-ant-')) {
        cliOutput(
          `\n${chalk.yellow('!')} Warning: API key format may be incorrect. Claude API keys typically start with 'sk-ant-'.\n`
        );
      }

      // Store the API key
      const success = await keychain.setClaudeApiKey(options.claudeApiKey);

      if (success) {
        // Initialize the API client
        await claudeApi.initialize();

        // Test the API key with a simple request (optional verification)
        try {
          await claudeApi.chat(
            [
              {
                role: 'user',
                content: 'Hi',
              },
            ],
            {
              model: 'claude-3-opus-20240229',
              max_tokens: 10,
            }
          );

          cliOutput(`\n${chalk.green('✓')} Claude API key configured successfully and verified.\n`);
        } catch (error) {
          // Verification failed, but key is stored - this is okay, user can test later
          log('API key verification failed (this is optional):', error);
          cliOutput(`\n${chalk.green('✓')} Claude API key stored successfully.\n`);
          cliOutput(
            `${chalk.yellow('Note:')} Verification test failed, but the key has been saved. You can test it when using Claude API features.\n`
          );
        }
      } else {
        cliOutput(`\n${chalk.red('✗')} Failed to store Claude API key.\n`);
        process.exit(1);
      }
    } else {
      // Show current configuration
      const apiKey = await keychain.getClaudeApiKey();

      if (apiKey) {
        const maskedKey = `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`;
        cliOutput(`\n${chalk.green('✓')} Claude API key is configured: ${maskedKey}\n`);
      } else {
        cliOutput(`\n${chalk.yellow('!')} Claude API key is not configured.\n`);
        cliOutput(
          `Set it using: ${chalk.cyan('npx @auth0/auth0-mcp-server config --claude-api-key <your-key>')}\n`
        );
      }
    }
  } catch (error) {
    log('Error in config command:', error);
    cliOutput(
      `\n${chalk.red('✗')} Configuration error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }
}

export default config;
