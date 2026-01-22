const { sqliteDb } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const nginxService = require('../services/nginx');
const phpFpmService = require('../services/php-fpm');
const nodejsService = require('../services/nodejs');
const pythonService = require('../services/python');

async function websitesRoutes(fastify, options) {

    // Get all websites
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        const websites = sqliteDb.prepare('SELECT * FROM websites ORDER BY created_at DESC').all();
        return reply.send(websites);
    });

    // Get single website
    fastify.get('/:id', { preHandler: authMiddleware }, async (request, reply) => {
        const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.id);
        if (!website) {
            return reply.code(404).send({ error: 'Website not found' });
        }
        return reply.send(website);
    });

    // Create website
    fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
        const { name, domain, runtime, php_version } = request.body;

        try {
            // Validate runtime
            if (!['php', 'nodejs', 'python'].includes(runtime)) {
                return reply.code(400).send({ error: 'Invalid runtime' });
            }

            // Allocate port for Node.js/Python
            let port = null;
            if (runtime === 'nodejs' || runtime === 'python') {
                port = await allocatePort();
            }

            // Insert website
            const result = sqliteDb.prepare(`
        INSERT INTO websites (name, domain, runtime, php_version, port, status)
        VALUES (?, ?, ?, ?, ?, 'stopped')
      `).run(name, domain, runtime, php_version || null, port);

            const websiteId = result.lastInsertRowid;

            // Create directory
            const websiteDir = `/var/www/${name}`;
            await execCommand(`mkdir -p ${websiteDir}`);
            await execCommand(`chown www-data:www-data ${websiteDir}`);

            // Generate Nginx config
            await nginxService.createVhost(websiteId, name, domain, runtime, php_version, port);

            // Create PHP-FPM pool if PHP
            if (runtime === 'php') {
                await phpFpmService.createPool(name, php_version || '8.2');
            }

            // Audit log
            sqliteDb.prepare(`
        INSERT INTO audit_log (user_id, action, details)
        VALUES (?, 'create_website', ?)
      `).run(request.session.user.id, JSON.stringify({ name, domain, runtime }));

            return reply.code(201).send({ id: websiteId, message: 'Website created successfully' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to create website' });
        }
    });

    // Start website
    fastify.post('/:id/start', { preHandler: authMiddleware }, async (request, reply) => {
        const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.id);

        if (!website) {
            return reply.code(404).send({ error: 'Website not found' });
        }

        try {
            if (website.runtime === 'nodejs') {
                await nodejsService.start(website);
            } else if (website.runtime === 'python') {
                await pythonService.start(website);
            }

            sqliteDb.prepare('UPDATE websites SET status = ? WHERE id = ?').run('running', website.id);

            return reply.send({ message: 'Website started' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to start website' });
        }
    });

    // Stop website
    fastify.post('/:id/stop', { preHandler: authMiddleware }, async (request, reply) => {
        const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.id);

        if (!website) {
            return reply.code(404).send({ error: 'Website not found' });
        }

        try {
            if (website.runtime === 'nodejs') {
                await nodejsService.stop(website);
            } else if (website.runtime === 'python') {
                await pythonService.stop(website);
            }

            sqliteDb.prepare('UPDATE websites SET status = ? WHERE id = ?').run('stopped', website.id);

            return reply.send({ message: 'Website stopped' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to stop website' });
        }
    });

    // Delete website
    fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
        const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.id);

        if (!website) {
            return reply.code(404).send({ error: 'Website not found' });
        }

        try {
            // Stop if running
            if (website.status === 'running') {
                if (website.runtime === 'nodejs') await nodejsService.stop(website);
                if (website.runtime === 'python') await pythonService.stop(website);
            }

            // Remove Nginx config
            await nginxService.removeVhost(website.name);

            // Remove PHP-FPM pool
            if (website.runtime === 'php') {
                await phpFpmService.removePool(website.name);
            }

            // Delete from database
            sqliteDb.prepare('DELETE FROM websites WHERE id = ?').run(website.id);

            return reply.send({ message: 'Website deleted' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to delete website' });
        }
    });
}

// Helper functions
const execCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        require('child_process').exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
};

const allocatePort = async () => {
    const usedPorts = sqliteDb.prepare('SELECT port FROM websites WHERE port IS NOT NULL').all().map(w => w.port);
    let port = 3000;
    while (usedPorts.includes(port)) {
        port++;
    }
    return port;
};

module.exports = websitesRoutes;
