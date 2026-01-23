const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const generateSecret = async (username) => {
    const secret = speakeasy.generateSecret({
        name: `NexPanel (${username})`,
        length: 32
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
        secret: secret.base32,
        qrCode
    };
};

const verifyToken = (secret, token) => {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
    });
};

const generateBackupCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
};

module.exports = {
    generateSecret,
    verifyToken,
    generateBackupCodes
};
