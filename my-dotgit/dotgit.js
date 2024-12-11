// Import necessary modules
const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const logger = console; // Simple logger for demonstration
const IgnoreManager = require('./lib/ignoreManager'); // Import IgnoreManager
const StagingArea = require('./lib/stagingArea'); // Import StagingArea
const crypto = require('crypto'); // Import crypto module for commit hash

// Initialize the command line program
const program = new Command();

// Initialize the repository
program
    .command('init')
    .description('Initialize a new dotgit repository')
    .action(async () => {
        try {
            const dotgitPath = path.resolve('.dotgit');
            // Check if repository already exists
            try {
                await fs.access(dotgitPath);
                logger.error('Repository already exists');
                return;
            } catch {
                // Directory doesn't exist, we can proceed
            }

            // Create directory structure
            const directories = [
                '',                 // Root .dotgit directory
                'refs',
                'refs/heads',
                'refs/tags',
                'objects',
                'objects/info',
                'objects/pack',
                'logs',
                'logs/refs',
                'logs/refs/heads',
                'hooks',
                'stash'
            ];

            // Create all directories
            for (const dir of directories) {
                await fs.mkdir(path.join(dotgitPath, dir), { recursive: true });
            }

            // Initialize essential files
            const initialFiles = {
                'HEAD': 'ref: refs/heads/main\n',
                'config': [
                    '[core]',
                    '\trepositoryformatversion = 0',
                    '\tfilemode = false',
                    '\tbare = false',
                    '\tlogallrefupdates = true',
                    '\tsymlinks = false',
                    '\tignorecase = true\n'
                ].join('\n'),
                'index': '', // Empty staging area
                'logs/HEAD': '', // Empty HEAD history
            };

            // Create all initial files
            for (const [file, content] of Object.entries(initialFiles)) {
                await fs.writeFile(path.join(dotgitPath, file), content);
            }

            const ignoreManager = new IgnoreManager();
            await ignoreManager.loadIgnoreFile(); // Load default ignore rules

            const stagingArea = new StagingArea(dotgitPath);
            await stagingArea.load(); // Load the staging area

            logger.info('Initialized empty dotgit repository with standard structure');
        } catch (error) {
            logger.error(`Failed to initialize repository: ${error.message}`);
            process.exit(1);
        }
    });

// Command to show current ignore rules
program
    .command('ignore')
    .description('Show current ignore rules')
    .action(async () => {
        const ignoreManager = new IgnoreManager();
        await ignoreManager.loadIgnoreFile();
        ignoreManager.printRules();
    });

// Add command to stage files
program
    .command('add <files...>')
    .description('Add file(s) to the staging area')
    .action(async (files) => {
        const dotgitPath = path.resolve('.dotgit');
        const stagingArea = new StagingArea(dotgitPath);
        await stagingArea.load();

        for (const filePath of files) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const fileData = {
                    content,
                    size: content.length,
                    timestamp: new Date().toISOString(),
                };
                await stagingArea.addFile(filePath, fileData);
                console.log(`Added ${filePath} to staging area.`);
            } catch (error) {
                console.error(`Failed to add ${filePath}: ${error.message}`);
            }
        }
    });

// Commit command to create new commits
program
    .command('commit')
    .description('Create a new commit with staged changes')
    .requiredOption('-m, --message <message>', 'Commit message')
    .action(async (options) => {
        const dotgitPath = path.resolve('.dotgit');
        const stagingArea = new StagingArea(dotgitPath);
        await stagingArea.load();

        if (stagingArea.stagedFiles.size === 0) {
            console.error('Nothing to commit (no files staged)');
            return;
        }

        const commitData = {
            message: options.message,
            timestamp: new Date().toISOString(),
            files: Array.from(stagingArea.stagedFiles.entries()).map(([filePath, data]) => ({
                path: filePath,
                content: data.content,
                size: data.size,
                timestamp: data.timestamp,
            })),
        };

        // Save commit data (you can implement a more complex commit structure later)
        const commitHash = crypto.createHash('sha1').update(JSON.stringify(commitData)).digest('hex');
        const commitPath = path.join(dotgitPath, 'objects', commitHash);
        await fs.writeFile(commitPath, JSON.stringify(commitData, null, 2));

        console.log(`Commit created: ${commitHash.substring(0, 7)} - ${options.message}`);

        // Clear the staging area after committing
        stagingArea.stagedFiles.clear();
        await stagingArea.save();
    });

program
    .command('log')
    .description('Show commit history')
    .action(async () => {
        const dotgitPath = path.resolve('.dotgit');
        const commits = await fs.readdir(path.join(dotgitPath, 'objects'));

        if (commits.length === 0) {
            console.log('No commits yet');
            return;
        }

        console.log('\nCommit History:');
        for (const commitHash of commits) {
            const commitData = await fs.readFile(path.join(dotgitPath, 'objects', commitHash), 'utf8');
            const commit = JSON.parse(commitData);
            console.log(`\ncommit ${commitHash.substring(0, 7)}`);
            console.log(`Message: ${commit.message}`);
            console.log(`Date: ${commit.timestamp}`);
            console.log(`Files:`);
            commit.files.forEach(file => {
                console.log(`- ${file.path} (size: ${file.size} bytes)`);
            });
        }
    });

program
    .command('branch [branchName]')
    .description('List, create, or delete branches')
    .option('-d, --delete <branch>', 'Delete a branch')
    .action(async (branchName, options) => {
        const dotgitPath = path.resolve('.dotgit');
        const branchesPath = path.join(dotgitPath, 'refs', 'heads');
        await fs.mkdir(branchesPath, { recursive: true });

        // Delete branch if -d option is used
        if (options.delete) {
            const branchToDelete = path.join(branchesPath, options.delete);
            try {
                await fs.unlink(branchToDelete);
                console.log(`Deleted branch '${options.delete}'`);
            } catch (error) {
                console.error(`Failed to delete branch: ${error.message}`);
            }
            return;
        }

        // Create a new branch if branchName is provided
        if (branchName) {
            const newBranchPath = path.join(branchesPath, branchName);
            try {
                await fs.writeFile(newBranchPath, 'main'); // Point to main by default
                console.log(`Created branch '${branchName}'`);
            } catch (error) {
                console.error(`Failed to create branch: ${error.message}`);
            }
            return;
        }

        // List all branches
        const branches = await fs.readdir(branchesPath);
        if (branches.length === 0) {
            console.log('No branches yet');
            return;
        }

        console.log('Branches:');
        for (const branch of branches) {
            console.log(`- ${branch}`);
        }
    });
