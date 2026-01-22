const authMiddleware = require('../middleware/auth');

async function sslRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'SSL API' });
    });
}

module.exports = sslRoutes;
