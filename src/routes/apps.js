const authMiddleware = require('../middleware/auth');

async function appsRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'One-Click Apps API' });
    });
}

module.exports = appsRoutes;
