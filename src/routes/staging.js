const authMiddleware = require('../middleware/auth');

async function stagingRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Staging API' });
    });
}

module.exports = stagingRoutes;
