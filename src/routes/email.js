const authMiddleware = require('../middleware/auth');

async function emailRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Email API' });
    });
}

module.exports = emailRoutes;
