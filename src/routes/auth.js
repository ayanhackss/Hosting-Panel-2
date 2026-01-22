const { sqliteDb } = require('../config/database');
const { hashPassword, verifyPassword } = require('../config/security');
const totpService = require('../services/totp');

async function authRoutes(fastify, options) {

    // Login page
    fastify.get('/login', async (request, reply) => {
        if (request.session.authenticated) {
            return reply.redirect('/');
        }
        return reply.view('login.ejs', { error: null });
    });

    // Login handler
    fastify.post('/login', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '5 minutes'
            }
        }
    }, async (request, reply) => {
        const { username, password, totp_token } = request.body;

        try {
            const user = sqliteDb.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

            if (!user) {
                return reply.view('login.ejs', { error: 'Invalid credentials' });
            }

            const validPassword = await verifyPassword(password, user.password_hash);
            if (!validPassword) {
                return reply.view('login.ejs', { error: 'Invalid credentials' });
            }

            // Check 2FA if enabled
            if (user.totp_enabled) {
                if (!totp_token) {
                    return reply.view('login.ejs', { error: 'TOTP token required', show_totp: true });
                }

                const validToken = totpService.verifyToken(user.totp_secret, totp_token);
                if (!validToken) {
                    return reply.view('login.ejs', { error: 'Invalid TOTP token', show_totp: true });
                }
            }

            // Set session
            request.session.authenticated = true;
            request.session.user = {
                id: user.id,
                username: user.username
            };

            // Audit log
            sqliteDb.prepare(`
        INSERT INTO audit_log (user_id, action, ip_address)
        VALUES (?, 'login', ?)
      `).run(user.id, request.ip);

            return reply.redirect('/');
        } catch (error) {
            fastify.log.error(error);
            return reply.view('login.ejs', { error: 'Login failed' });
        }
    });

    // Logout
    fastify.get('/logout', async (request, reply) => {
        request.session.destroy();
        return reply.redirect('/auth/login');
    });

    // Setup 2FA
    fastify.get('/setup-2fa', async (request, reply) => {
        if (!request.session.authenticated) {
            return reply.redirect('/auth/login');
        }

        const user = sqliteDb.prepare('SELECT * FROM admin_users WHERE id = ?').get(request.session.user.id);

        if (user.totp_enabled) {
            return reply.send({ error: '2FA already enabled' });
        }

        const { secret, qrCode } = await totpService.generateSecret(user.username);

        return reply.view('setup-2fa.ejs', { qrCode, secret });
    });

    // Verify and enable 2FA
    fastify.post('/enable-2fa', async (request, reply) => {
        if (!request.session.authenticated) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { secret, token } = request.body;
        const valid = totpService.verifyToken(secret, token);

        if (!valid) {
            return reply.code(400).send({ error: 'Invalid token' });
        }

        const backupCodes = totpService.generateBackupCodes();

        sqliteDb.prepare(`
      UPDATE admin_users 
      SET totp_secret = ?, totp_enabled = 1, backup_codes = ?
      WHERE id = ?
    `).run(secret, JSON.stringify(backupCodes), request.session.user.id);

        return reply.send({ success: true, backupCodes });
    });
}

module.exports = authRoutes;
