const authMiddleware = require('../middleware/auth');

async function redisRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Redis API' });
    });
}

module.exports = redisRoutes;
