/**
 * Git operations for creating branches, commits, and PRs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { log } from './logger.js';

const execAsync = promisify(exec);

export interface GitConfig {
  /** Path to the git repository */
  repoPath: string;
  /** Base branch for PRs (default: main) */
  baseBranch?: string;
}

export interface CreatePRResult {
  /** URL of the created PR */
  prUrl: string;
  /** Name of the branch created */
  branchName: string;
  /** Files that were changed */
  filesChanged: string[];
}

export interface GitOperationError {
  code: 'GIT_ERROR' | 'GH_CLI_ERROR' | 'FILESYSTEM_ERROR' | 'VALIDATION_ERROR';
  message: string;
  details?: string;
  recoveryAction?: string;
}

/**
 * Execute a command in a specific directory
 */
async function execInDir(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  log(`Executing: ${command} in ${cwd}`);
  try {
    const result = await execAsync(command, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return result;
  } catch (error: any) {
    log(`Command failed: ${error.message}`);
    throw error;
  }
}

/**
 * Validate that a directory is a valid git repository
 */
export async function validateGitRepo(
  repoPath: string
): Promise<{ valid: boolean; error?: GitOperationError }> {
  try {
    // Check if directory exists
    const stats = await fs.stat(repoPath);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Path is not a directory: ${repoPath}`,
        },
      };
    }

    // Check if it's a git repository
    await execInDir('git rev-parse --git-dir', repoPath);

    // Check if we have write access
    await fs.access(repoPath, fs.constants.W_OK);

    return { valid: true };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Directory does not exist: ${repoPath}`,
        },
      };
    }
    if (error.message?.includes('not a git repository')) {
      return {
        valid: false,
        error: {
          code: 'GIT_ERROR',
          message: `Not a git repository: ${repoPath}`,
          recoveryAction: 'Run `git init` to initialize a repository',
        },
      };
    }
    return {
      valid: false,
      error: {
        code: 'GIT_ERROR',
        message: `Cannot access repository: ${error.message}`,
      },
    };
  }
}

/**
 * Check if gh CLI is available and authenticated
 */
export async function checkGhCli(): Promise<{ available: boolean; error?: GitOperationError }> {
  try {
    await execAsync('gh auth status');
    return { available: true };
  } catch (error: any) {
    if (error.message?.includes('command not found') || error.message?.includes('not recognized')) {
      return {
        available: false,
        error: {
          code: 'GH_CLI_ERROR',
          message: 'GitHub CLI (gh) is not installed',
          recoveryAction: 'Install gh: https://cli.github.com/',
        },
      };
    }
    if (error.message?.includes('not logged in') || error.stderr?.includes('not logged in')) {
      return {
        available: false,
        error: {
          code: 'GH_CLI_ERROR',
          message: 'GitHub CLI is not authenticated',
          recoveryAction: 'Run `gh auth login` to authenticate',
        },
      };
    }
    return {
      available: false,
      error: {
        code: 'GH_CLI_ERROR',
        message: `GitHub CLI check failed: ${error.message}`,
      },
    };
  }
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await execInDir('git branch --show-current', repoPath);
  return stdout.trim();
}

/**
 * Get the default branch of the repository
 */
export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execInDir(
      'git symbolic-ref refs/remotes/origin/HEAD --short',
      repoPath
    );
    return stdout.trim().replace('origin/', '');
  } catch {
    // Fall back to common defaults
    try {
      await execInDir('git rev-parse --verify origin/main', repoPath);
      return 'main';
    } catch {
      return 'master';
    }
  }
}

/**
 * Fetch latest changes from remote
 */
export async function fetchLatest(repoPath: string): Promise<void> {
  await execInDir('git fetch origin', repoPath);
}

/**
 * Create a new branch from the base branch
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  baseBranch?: string
): Promise<void> {
  const base = baseBranch || (await getDefaultBranch(repoPath));

  // Fetch latest
  await fetchLatest(repoPath);

  // Create and checkout new branch from origin/base
  await execInDir(`git checkout -b ${branchName} origin/${base}`, repoPath);
  log(`Created branch: ${branchName} from origin/${base}`);
}

/**
 * Generate a branch name for an Auth0 export
 */
export function generateBranchName(resourceType: string, resourceName: string): string {
  const sanitizedName = resourceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

  return `auth0/export-${resourceType}-${sanitizedName}-${timestamp}`;
}

/**
 * Append content to a file
 */
export async function appendToFile(
  repoPath: string,
  filePath: string,
  content: string
): Promise<string> {
  const fullPath = path.join(repoPath, filePath);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Check if file exists
  let existingContent = '';
  try {
    existingContent = await fs.readFile(fullPath, 'utf-8');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // File doesn't exist, will create new
  }

  // Append content with newlines
  const newContent = existingContent ? `${existingContent}\n${content}\n` : `${content}\n`;

  await fs.writeFile(fullPath, newContent, 'utf-8');
  log(`Updated file: ${fullPath}`);

  return filePath;
}

/**
 * Stage files for commit
 */
export async function stageFiles(repoPath: string, files: string[]): Promise<void> {
  for (const file of files) {
    await execInDir(`git add "${file}"`, repoPath);
  }
  log(`Staged ${files.length} file(s)`);
}

/**
 * Create a commit
 */
export async function commitChanges(
  repoPath: string,
  message: string,
  files?: string[]
): Promise<void> {
  if (files && files.length > 0) {
    await stageFiles(repoPath, files);
  }

  // Use heredoc-style commit to handle special characters in message
  const escapedMessage = message.replace(/'/g, "'\\''");
  await execInDir(`git commit -m '${escapedMessage}'`, repoPath);
  log(`Created commit: ${message.substring(0, 50)}...`);
}

/**
 * Push branch to remote
 */
export async function pushBranch(repoPath: string, branchName: string): Promise<void> {
  await execInDir(`git push -u origin ${branchName}`, repoPath);
  log(`Pushed branch: ${branchName}`);
}

/**
 * Create a pull request using gh CLI
 */
export async function createPullRequest(
  repoPath: string,
  branchName: string,
  title: string,
  body: string,
  baseBranch?: string
): Promise<string> {
  const base = baseBranch || (await getDefaultBranch(repoPath));

  // Escape the body for shell
  const escapedBody = body.replace(/'/g, "'\\''");

  const command = `gh pr create --title '${title.replace(/'/g, "'\\''")}' --body '${escapedBody}' --base ${base}`;

  const { stdout } = await execInDir(command, repoPath);
  const prUrl = stdout.trim();
  log(`Created PR: ${prUrl}`);

  return prUrl;
}

/**
 * Checkout the original branch (cleanup)
 */
export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  await execInDir(`git checkout ${branchName}`, repoPath);
}

/**
 * Delete a local branch
 */
export async function deleteLocalBranch(repoPath: string, branchName: string): Promise<void> {
  await execInDir(`git branch -D ${branchName}`, repoPath);
  log(`Deleted local branch: ${branchName}`);
}

/**
 * Complete workflow: create branch, add file, commit, push, create PR
 */
export async function createPRWithChanges(
  config: GitConfig,
  options: {
    branchName: string;
    filePath: string;
    content: string;
    commitMessage: string;
    prTitle: string;
    prBody: string;
  }
): Promise<CreatePRResult> {
  const { repoPath, baseBranch } = config;
  const { branchName, filePath, content, commitMessage, prTitle, prBody } = options;

  // Store original branch to return to on error
  const originalBranch = await getCurrentBranch(repoPath);

  try {
    // 1. Create new branch
    await createBranch(repoPath, branchName, baseBranch);

    // 2. Append content to file
    await appendToFile(repoPath, filePath, content);

    // 3. Commit changes
    await commitChanges(repoPath, commitMessage, [filePath]);

    // 4. Push branch
    await pushBranch(repoPath, branchName);

    // 5. Create PR
    const prUrl = await createPullRequest(repoPath, branchName, prTitle, prBody, baseBranch);

    // 6. Return to original branch
    await checkoutBranch(repoPath, originalBranch);

    return {
      prUrl,
      branchName,
      filesChanged: [filePath],
    };
  } catch (error: any) {
    // Try to return to original branch
    try {
      await checkoutBranch(repoPath, originalBranch);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
