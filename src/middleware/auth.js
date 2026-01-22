const authMiddleware = async (request, reply) => {
    if (!request.session.authenticated) {
        return reply.code(401).send({ error: 'Unauthorized' });
    }
};

module.exports = authMiddleware;
