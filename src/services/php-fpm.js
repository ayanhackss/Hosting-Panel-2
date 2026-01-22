const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const PHP_FPM_POOL_DIR = '/etc/php';

const createPool = async (name, phpVersion) => {
    const poolConfig = generatePoolConfig(name, phpVersion);
    const poolPath = `${PHP_FPM_POOL_DIR}/${phpVersion}/fpm/pool.d/${name}.conf`;

    try {
        await fs.writeFile(poolPath, poolConfig);
        await execAsync(`systemctl reload php${phpVersion}-fpm`);
        return true;
    } catch (error) {
        await fs.unlink(poolPath).catch(() => { });
        throw error;
    }
};

const removePool = async (name) => {
    const versions = ['7.4', '8.0', '8.1', '8.2'];

    for (const version of versions) {
        const poolPath = `${PHP_FPM_POOL_DIR}/${version}/fpm/pool.d/${name}.conf`;
        await fs.unlink(poolPath).catch(() => { });
        await execAsync(`systemctl reload php${version}-fpm`).catch(() => { });
    }
};

const switchVersion = async (name, oldVersion, newVersion) => {
    await removePool(name);
    await createPool(name, newVersion);
};

const generatePoolConfig = (name, phpVersion) => {
    return `[${name}]
user = www-data
group = www-data
listen = /run/php/php${phpVersion}-fpm-${name}.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = ondemand
pm.max_children = 5
pm.process_idle_timeout = 10s
pm.max_requests = 500

php_admin_value[error_log] = /var/log/php-fpm/${name}-error.log
php_admin_flag[log_errors] = on
php_admin_value[memory_limit] = 128M
php_admin_value[upload_max_filesize] = 100M
php_admin_value[post_max_size] = 100M

chdir = /var/www/${name}
`;
};

module.exports = {
    createPool,
    removePool,
    switchVersion
};
