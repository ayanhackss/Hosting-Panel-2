const authMiddleware = require('../middleware/auth');

async function ftpRoutes(fastify, options) {
    fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
        return reply.send({ message: 'FTP API' });
    });
}

module.exports = ftpRoutes;
