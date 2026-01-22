const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const clone = async (repoUrl, destination, branch = 'main', deployKey = null) => {
    try {
        let cloneCmd = `git clone -b ${branch} ${repoUrl} ${destination}`;

        if (deployKey) {
            // Use SSH key for private repos
            const keyPath = `/tmp/deploy_key_${Date.now()}`;
            await execAsync(`echo "${deployKey}" > ${keyPath} && chmod 600 ${keyPath}`);
            cloneCmd = `GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no" ${cloneCmd}`;
        }

        await execAsync(cloneCmd);
        return true;
    } catch (error) {
        throw new Error(`Git clone failed: ${error.message}`);
    }
};

const pull = async (repoPath, branch = 'main') => {
    try {
        await execAsync(`cd ${repoPath} && git pull origin ${branch}`);
        return true;
    } catch (error) {
        throw new Error(`Git pull failed: ${error.message}`);
    }
};

const push = async (repoPath, branch = 'main') => {
    try {
        await execAsync(`cd ${repoPath} && git add . && git commit -m "Auto commit" && git push origin ${branch}`);
        return true;
    } catch (error) {
        throw new Error(`Git push failed: ${error.message}`);
    }
};

const getBranches = async (repoPath) => {
    try {
        const { stdout } = await execAsync(`cd ${repoPath} && git branch -a`);
        return stdout.split('\n').filter(b => b.trim()).map(b => b.replace('*', '').trim());
    } catch (error) {
        return [];
    }
};

const checkout = async (repoPath, branch) => {
    try {
        await execAsync(`cd ${repoPath} && git checkout ${branch}`);
        return true;
    } catch (error) {
        throw new Error(`Git checkout failed: ${error.message}`);
    }
};

const getCommitHistory = async (repoPath, limit = 10) => {
    try {
        const { stdout } = await execAsync(`cd ${repoPath} && git log --pretty=format:'%h|%an|%ar|%s' -n ${limit}`);
        return stdout.split('\n').map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
        });
    } catch (error) {
        return [];
    }
};

module.exports = {
    clone,
    pull,
    push,
    getBranches,
    checkout,
    getCommitHistory
};
