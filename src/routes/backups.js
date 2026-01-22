const authMiddleware = require('../middleware/auth');

async function backupsRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Backups API' });
    });
}

module.exports = backupsRoutes;
