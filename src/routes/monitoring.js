const authMiddleware = require('../middleware/auth');
const monitoringService = require('../services/monitoring');

async function monitoringRoutes(fastify, options) {

    // Get system stats
    fastify.get('/stats', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const stats = await monitoringService.getSystemStats();
            return reply.send(stats);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to get system stats' });
        }
    });

    // Get service status
    fastify.get('/services', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const services = await monitoringService.getServiceStatus();
            return reply.send(services);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to get service status' });
        }
    });

    // Get traffic stats
    fastify.get('/traffic', { preHandler: authMiddleware }, async (request, reply) => {
        try {
            const traffic = await monitoringService.getTrafficStats();
            return reply.send(traffic);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to get traffic stats' });
        }
    });
}

module.exports = monitoringRoutes;
