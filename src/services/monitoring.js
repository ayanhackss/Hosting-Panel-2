const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const os = require('os');

const getSystemStats = async () => {
    try {
        // CPU usage
        const cpuUsage = await getCpuUsage();

        // Memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(2);

        // Disk usage
        const { stdout: diskInfo } = await execAsync("df -h / | tail -1 | awk '{print $3,$2,$5}'");
        const [diskUsed, diskTotal, diskPercent] = diskInfo.trim().split(' ');

        // Load average
        const loadAvg = os.loadavg();

        return {
            cpu: {
                usage: cpuUsage,
                cores: os.cpus().length
            },
            memory: {
                total: formatBytes(totalMem),
                used: formatBytes(usedMem),
                free: formatBytes(freeMem),
                percent: memPercent
            },
            disk: {
                total: diskTotal,
                used: diskUsed,
                percent: diskPercent
            },
            load: {
                '1min': loadAvg[0].toFixed(2),
                '5min': loadAvg[1].toFixed(2),
                '15min': loadAvg[2].toFixed(2)
            },
            uptime: formatUptime(os.uptime())
        };
    } catch (error) {
        throw new Error(`Failed to get system stats: ${error.message}`);
    }
};

const getServiceStatus = async () => {
    const services = ['nginx', 'mariadb', 'php8.2-fpm', 'redis-server', 'postfix'];
    const status = {};

    for (const service of services) {
        try {
            const { stdout } = await execAsync(`systemctl is-active ${service}`);
            status[service] = stdout.trim() === 'active';
        } catch {
            status[service] = false;
        }
    }

    return status;
};

const getTrafficStats = async () => {
    try {
        const { stdout } = await execAsync(`
      awk '
        /GET|POST/ {requests++}
        /HTTP\\/[0-9].[0-9]" 2/ {errors++}
        /HTTP\\/[0-9].[0-9]" [45]/ {errors++}
        {bytes+=$10}
        END {print requests, errors, bytes}
      ' /var/log/nginx/access.log
    `);

        const [requests, errors, bytes] = stdout.trim().split(' ').map(Number);

        return {
            requests: requests || 0,
            errors: errors || 0,
            bandwidth: formatBytes(bytes || 0)
        };
    } catch {
        return { requests: 0, errors: 0, bandwidth: '0 B' };
    }
};

const getCpuUsage = () => {
    return new Promise((resolve) => {
        const startMeasure = cpuAverage();

        setTimeout(() => {
            const endMeasure = cpuAverage();
            const idleDiff = endMeasure.idle - startMeasure.idle;
            const totalDiff = endMeasure.total - startMeasure.total;
            const percentageCPU = 100 - (100 * idleDiff / totalDiff);
            resolve(percentageCPU.toFixed(2));
        }, 1000);
    });
};

const cpuAverage = () => {
    const cpus = os.cpus();
    let idleMs = 0, totalMs = 0;

    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalMs += cpu.times[type];
        }
        idleMs += cpu.times.idle;
    });

    return { idle: idleMs / cpus.length, total: totalMs / cpus.length };
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
};

module.exports = {
    getSystemStats,
    getServiceStatus,
    getTrafficStats
};
