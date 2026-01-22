const authMiddleware = require('../middleware/auth');

async function securityRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Security API' });
    });
}

module.exports = securityRoutes;
