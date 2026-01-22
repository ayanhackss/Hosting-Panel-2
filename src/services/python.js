const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const start = async (website) => {
    const appPath = `/var/www/${website.name}`;
    const venvPath = `${appPath}/venv`;
    const appName = website.name;

    try {
        // Create virtualenv if not exists
        await execAsync(`test -d ${venvPath} || python3 -m venv ${venvPath}`);

        // Install requirements
        const reqFile = `${appPath}/requirements.txt`;
        await execAsync(`test -f ${reqFile} && ${venvPath}/bin/pip install -r ${reqFile}`);

        // Detect framework and start
        const framework = await detectFramework(appPath);

        let startCommand;
        if (framework === 'django') {
            startCommand = `${venvPath}/bin/gunicorn --bind 127.0.0.1:${website.port} --workers 2 --timeout 300 wsgi:application`;
        } else if (framework === 'flask') {
            startCommand = `${venvPath}/bin/gunicorn --bind 127.0.0.1:${website.port} --workers 2 --timeout 300 app:app`;
        } else {
            // FastAPI or generic ASGI
            startCommand = `${venvPath}/bin/uvicorn main:app --host 127.0.0.1 --port ${website.port} --workers 2`;
        }

        // Start with PM2
        await execAsync(`cd ${appPath} && pm2 start "${startCommand}" --name ${appName}`);
        await execAsync(`pm2 save`);

        return true;
    } catch (error) {
        throw new Error(`Failed to start Python app: ${error.message}`);
    }
};

const stop = async (website) => {
    try {
        await execAsync(`pm2 delete ${website.name}`);
        await execAsync(`pm2 save`);
        return true;
    } catch (error) {
        throw new Error(`Failed to stop Python app: ${error.message}`);
    }
};

const restart = async (website) => {
    try {
        await execAsync(`pm2 restart ${website.name}`);
        return true;
    } catch (error) {
        throw new Error(`Failed to restart Python app: ${error.message}`);
    }
};

const detectFramework = async (appPath) => {
    try {
        const { stdout } = await execAsync(`grep -l "django\\|Django" ${appPath}/*.py 2>/dev/null || echo ""`);
        if (stdout) return 'django';

        const { stdout: flask } = await execAsync(`grep -l "flask\\|Flask" ${appPath}/*.py 2>/dev/null || echo ""`);
        if (flask) return 'flask';

        return 'fastapi';
    } catch {
        return 'fastapi';
    }
};

module.exports = {
    start,
    stop,
    restart
};
