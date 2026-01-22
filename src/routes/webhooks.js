const authMiddleware = require('../middleware/auth');

async function webhooksRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Webhooks API' });
    });
}

module.exports = webhooksRoutes;
