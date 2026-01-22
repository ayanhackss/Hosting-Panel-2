const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NGINX_SITES_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';

const createVhost = async (websiteId, name, domain, runtime, phpVersion, port) => {
    let template;

    if (runtime === 'php') {
        template = generatePhpConfig(name, domain, phpVersion);
    } else if (runtime === 'nodejs') {
        template = generateNodeConfig(name, domain, port);
    } else if (runtime === 'python') {
        template = generatePythonConfig(name, domain, port);
    }

    const configPath = `${NGINX_SITES_AVAILABLE}/${name}`;
    const symlinkPath = `${NGINX_SITES_ENABLED}/${name}`;

    try {
        // Write config
        await fs.writeFile(configPath, template);

        // Create symlink
        await fs.symlink(configPath, symlinkPath);

        // Test configuration
        const { stderr } = await execAsync('nginx -t');
        if (stderr && !stderr.includes('successful')) {
            throw new Error('Nginx configuration test failed');
        }

        // Reload Nginx
        await execAsync('systemctl reload nginx');

        return true;
    } catch (error) {
        // Rollback on failure
        await fs.unlink(configPath).catch(() => { });
        await fs.unlink(symlinkPath).catch(() => { });
        throw error;
    }
};

const removeVhost = async (name) => {
    const configPath = `${NGINX_SITES_AVAILABLE}/${name}`;
    const symlinkPath = `${NGINX_SITES_ENABLED}/${name}`;

    await fs.unlink(symlinkPath).catch(() => { });
    await fs.unlink(configPath).catch(() => { });
    await execAsync('systemctl reload nginx');
};

const generatePhpConfig = (name, domain, phpVersion) => {
    return `server {
    listen 80;
    server_name ${domain};
    root /var/www/${name}/public;
    index index.php index.html;

    access_log /var/log/nginx/${name}-access.log;
    error_log /var/log/nginx/${name}-error.log;

    client_max_body_size 100M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php${phpVersion}-fpm-${name}.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.ht {
        deny all;
    }

    location ~ /\\.git {
        deny all;
    }
}
`;
};

const generateNodeConfig = (name, domain, port) => {
    return `server {
    listen 80;
    server_name ${domain};

    access_log /var/log/nginx/${name}-access.log;
    error_log /var/log/nginx/${name}-error.log;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
`;
};

const generatePythonConfig = (name, domain, port) => {
    return `server {
    listen 80;
    server_name ${domain};

    access_log /var/log/nginx/${name}-access.log;
    error_log /var/log/nginx/${name}-error.log;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /static {
        alias /var/www/${name}/static;
        expires 30d;
    }
}
`;
};

module.exports = {
    createVhost,
    removeVhost
};
