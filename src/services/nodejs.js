const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const start = async (website) => {
    const appPath = `/var/www/${website.name}`;
    const appName = website.name;

    try {
        // Check if package.json exists
        const { stdout } = await execAsync(`test -f ${appPath}/package.json && echo "exists"`);

        if (!stdout.includes('exists')) {
            throw new Error('package.json not found');
        }

        // Install dependencies if needed
        await execAsync(`cd ${appPath} && npm install --production`);

        // Start with PM2
        await execAsync(`pm2 start ${appPath}/index.js --name ${appName} -i 1 --max-memory-restart 256M`);
        await execAsync(`pm2 save`);

        return true;
    } catch (error) {
        throw new Error(`Failed to start Node.js app: ${error.message}`);
    }
};

const stop = async (website) => {
    try {
        await execAsync(`pm2 delete ${website.name}`);
        await execAsync(`pm2 save`);
        return true;
    } catch (error) {
        throw new Error(`Failed to stop Node.js app: ${error.message}`);
    }
};

const restart = async (website) => {
    try {
        await execAsync(`pm2 restart ${website.name}`);
        return true;
    } catch (error) {
        throw new Error(`Failed to restart Node.js app: ${error.message}`);
    }
};

const getLogs = async (website, lines = 100) => {
    try {
        const { stdout } = await execAsync(`pm2 logs ${website.name} --lines ${lines} --nostream`);
        return stdout;
    } catch (error) {
        return '';
    }
};

module.exports = {
    start,
    stop,
    restart,
    getLogs
};
