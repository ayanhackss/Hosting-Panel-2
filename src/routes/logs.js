const authMiddleware = require('../middleware/auth');
const logsService = require('../services/logs');

async function logsRoutes(fastify, options) {

    // Get available logs
    fastify.get('/list', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const logs = await logsService.getAvailableLogs();
            return reply.send(logs);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to list logs' });
        }
    });

    // Tail log file
    fastify.get('/tail', { preHandler: authMiddleware }, async (request, reply) => {
        const { path, lines } = request.query;

        if (!path) {
            return reply.code(400).send({ error: 'Log path required' });
        }

        try {
            const content = await logsService.tailLog(path, parseInt(lines) || 100);
            return reply.send({ content });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to read log' });
        }
    });

    // Search log file
    fastify.get('/search', { preHandler: authMiddleware }, async (request, reply) => {
        const { path, query } = request.query;

        if (!path || !query) {
            return reply.code(400).send({ error: 'Path and query required' });
        }

        try {
            const results = await logsService.searchLog(path, query);
            return reply.send({ results });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to search log' });
        }
    });

    // Stream log (real-time)
    fastify.get('/stream', { preHandler: authMiddleware }, async (request, reply) => {
        const { path } = request.query;

        if (!path) {
            return reply.code(400).send({ error: 'Log path required' });
        }

        try {
            const stream = logsService.streamLog(path);
            reply.type('text/plain');
            return reply.send(stream);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to stream log' });
        }
    });

    // Compress old logs
    fastify.post('/compress', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            await logsService.compressOldLogs();
            return reply.send({ message: 'Old logs compressed successfully' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to compress logs' });
        }
    });
}

module.exports = logsRoutes;
