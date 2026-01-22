const authMiddleware = require('../middleware/auth');

async function cronRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Cron API' });
    });
}

module.exports = cronRoutes;
