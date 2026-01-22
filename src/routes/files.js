const authMiddleware = require('../middleware/auth');

async function filesRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'File Manager API' });
    });
}

module.exports = filesRoutes;
