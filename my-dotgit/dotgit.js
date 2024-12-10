// Import necessary modules
const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const logger = console; // Simple logger for demonstration
const IgnoreManager = require('./lib/ignoreManager'); // Import IgnoreManager
const StagingArea = require('./lib/stagingArea'); // Import StagingArea

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

// Parse command line arguments
program.parse(process.argv);
