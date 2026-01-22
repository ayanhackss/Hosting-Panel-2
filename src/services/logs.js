const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const readline = require('readline');

const tailLog = async (logPath, lines = 100) => {
    try {
        const { stdout } = await execAsync(`tail -n ${lines} ${logPath}`);
        return stdout;
    } catch (error) {
        throw new Error(`Failed to read log: ${error.message}`);
    }
};

const searchLog = async (logPath, query) => {
    try {
        const { stdout } = await execAsync(`grep -i "${query}" ${logPath} | tail -n 100`);
        return stdout;
    } catch (error) {
        return ''; // No matches
    }
};

const streamLog = (logPath) => {
    // Returns a readable stream for real-time log tailing
    const tail = exec(`tail -f ${logPath}`);
    return tail.stdout;
};

const getAvailableLogs = async () => {
    const logDirs = [
        '/var/log/nginx',
        '/var/log/php-fpm',
        '/var/log/mysql',
        '/var/www'
    ];

    const logs = [];

    for (const dir of logDirs) {
        try {
            const { stdout } = await execAsync(`find ${dir} -name "*.log" -type f 2>/dev/null`);
            logs.push(...stdout.split('\n').filter(l => l));
        } catch {
            // Directory doesn't exist or no permission
        }
    }

    return logs;
};

const compressOldLogs = async () => {
    try {
        // Compress logs older than 7 days
        await execAsync(`find /var/log -name "*.log" -mtime +7 -exec gzip {} \\;`);
        return true;
    } catch (error) {
        throw new Error(`Log compression failed: ${error.message}`);
    }
};

module.exports = {
    tailLog,
    searchLog,
    streamLog,
    getAvailableLogs,
    compressOldLogs
};
