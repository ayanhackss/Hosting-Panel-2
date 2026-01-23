const fastify = require('fastify')({ logger: true });
const path = require('path');
const fs = require('fs');

// Security plugins
fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:']
    }
  }
});

// Rate limiting
fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '15 minutes'
});

// Cookie and session support
fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/session'), {
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production-min-32-chars-long',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1800000 // 30 minutes
  }
});

// View engine
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views')
});

// Static files
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
});

// Routes
fastify.register(require('./routes/auth'), { prefix: '/auth' });
fastify.register(require('./routes/websites'), { prefix: '/api/websites' });
fastify.register(require('./routes/domains'), { prefix: '/api/domains' });
fastify.register(require('./routes/databases'), { prefix: '/api/databases' });
fastify.register(require('./routes/ssl'), { prefix: '/api/ssl' });
fastify.register(require('./routes/backups'), { prefix: '/api/backups' });
fastify.register(require('./routes/cron'), { prefix: '/api/cron' });
fastify.register(require('./routes/files'), { prefix: '/api/files' });
fastify.register(require('./routes/git'), { prefix: '/api/git' });
fastify.register(require('./routes/monitoring'), { prefix: '/api/monitoring' });
fastify.register(require('./routes/logs'), { prefix: '/api/logs' });
fastify.register(require('./routes/security'), { prefix: '/api/security' });
fastify.register(require('./routes/apps'), { prefix: '/api/apps' });
fastify.register(require('./routes/ftp'), { prefix: '/api/ftp' });
fastify.register(require('./routes/redis'), { prefix: '/api/redis' });
fastify.register(require('./routes/webhooks'), { prefix: '/api/webhooks' });
fastify.register(require('./routes/email'), { prefix: '/api/email' });
fastify.register(require('./routes/staging'), { prefix: '/api/staging' });

// Dashboard route
fastify.get('/', async (request, reply) => {
  if (!request.session.authenticated) {
    return reply.redirect('/auth/login');
  }
  return reply.view('dashboard.ejs', { user: request.session.user });
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 8080;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`\n🚀 NexPanel running on http://${host}:${port}`);
    console.log(`📊 Dashboard: http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
