const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateSessionSecret = () => {
    return require('crypto').randomBytes(32).toString('hex');
};

module.exports = {
    hashPassword,
    verifyPassword,
    generateSessionSecret,
    SALT_ROUNDS
};
