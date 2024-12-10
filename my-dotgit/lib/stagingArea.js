const fs = require('fs').promises;
const path = require('path');

class StagingArea {
    constructor(dotgitPath) {
        this.indexPath = path.join(dotgitPath, 'index');
        this.stagedFiles = new Map();
    }

    async load() {
        try {
            await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
            const content = await fs.readFile(this.indexPath, 'utf8').catch(() => '[]');
            this.stagedFiles = new Map(JSON.parse(content));
        } catch (error) {
            this.stagedFiles = new Map();
        }
    }

    async save() {
        const content = JSON.stringify(Array.from(this.stagedFiles.entries()));
        await fs.writeFile(this.indexPath, content, 'utf8');
    }

    async addFile(filePath, fileData) {
        this.stagedFiles.set(filePath, fileData);
        await this.save();
    }
}

module.exports = StagingArea; 