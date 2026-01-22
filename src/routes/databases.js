const authMiddleware = require('../middleware/auth');

async function databasesRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'Databases API' });
    });
}

module.exports = databasesRoutes;
