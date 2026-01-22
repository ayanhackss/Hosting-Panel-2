const { sqliteDb } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const gitService = require('../services/git');

async function gitRoutes(fastify, options) {

    // Clone repository
    fastify.post('/clone', { preHandler: authMiddleware }, async (request, reply) => {
        const { website_id, repo_url, branch, deploy_key } = request.body;

        try {
            const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(website_id);
            if (!website) {
                return reply.code(404).send({ error: 'Website not found' });
            }

            const destination = `/var/www/${website.name}`;
            await gitService.clone(repo_url, destination, branch || 'main', deploy_key);

            // Save to database
            sqliteDb.prepare(`
        INSERT INTO git_repos (website_id, repo_url, branch, deploy_key)
        VALUES (?, ?, ?, ?)
      `).run(website_id, repo_url, branch || 'main', deploy_key || null);

            return reply.send({ message: 'Repository cloned successfully' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });

    // Pull latest changes
    fastify.post('/:website_id/pull', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.website_id);
            if (!website) {
                return reply.code(404).send({ error: 'Website not found' });
            }

            const repo = sqliteDb.prepare('SELECT * FROM git_repos WHERE website_id = ?').get(website.id);
            if (!repo) {
                return reply.code(404).send({ error: 'No git repository configured' });
            }

            const repoPath = `/var/www/${website.name}`;
            await gitService.pull(repoPath, repo.branch);

            return reply.send({ message: 'Repository updated successfully' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });

    // Get commit history
    fastify.get('/:website_id/commits', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.website_id);
            if (!website) {
                return reply.code(404).send({ error: 'Website not found' });
            }

            const repoPath = `/var/www/${website.name}`;
            const commits = await gitService.getCommitHistory(repoPath, 20);

            return reply.send(commits);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });

    // Get branches
    fastify.get('/:website_id/branches', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.website_id);
            if (!website) {
                return reply.code(404).send({ error: 'Website not found' });
            }

            const repoPath = `/var/www/${website.name}`;
            const branches = await gitService.getBranches(repoPath);

            return reply.send(branches);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });

    // Checkout branch
    fastify.post('/:website_id/checkout', { preHandler: authMiddleware }, async (request, reply) => {
        const { branch } = request.body;

        try {
            const website = sqliteDb.prepare('SELECT * FROM websites WHERE id = ?').get(request.params.website_id);
            if (!website) {
                return reply.code(404).send({ error: 'Website not found' });
            }

            const repoPath = `/var/www/${website.name}`;
            await gitService.checkout(repoPath, branch);

            // Update database
            sqliteDb.prepare('UPDATE git_repos SET branch = ? WHERE website_id = ?').run(branch, website.id);

            return reply.send({ message: `Switched to branch ${branch}` });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });
}

module.exports = gitRoutes;
