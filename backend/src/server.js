import { createServer } from 'node:http';
import { formatStartupFailure } from './utils/startup-diagnostics.js';

async function startServer() {
  let prisma;
  let server;
  let config;
  let startupStage = 'environment configuration';

  try {
    ({ config } = await import('./config/environment.js'));
    startupStage = 'application initialization';
    const [{ default: app }, database] = await Promise.all([
      import('./app.js'),
      import('./config/database.js'),
    ]);

    prisma = database.prisma;
    startupStage = 'database connection';
    await prisma.$connect();

    startupStage = 'HTTP server binding';
    server = createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, resolve);
    });

    console.log(`Ztalent Coder API listening on port ${config.port}`);

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}; shutting down.`);

      let shutdownFailed = false;
      try {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
        console.log('HTTP server closed.');
      } catch {
        console.error('Failed to close the HTTP server cleanly.');
        shutdownFailed = true;
      }

      try {
        await prisma.$disconnect();
        console.log('Prisma disconnected.');
      } catch {
        console.error('Failed to disconnect from the database cleanly.');
        shutdownFailed = true;
      }

      process.exitCode = shutdownFailed ? 1 : 0;
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    const diagnosticOptions = {
      stage: startupStage,
      port: config?.port,
      databaseUrl: config?.databaseUrl,
      sensitiveValues: getSensitiveEnvironmentValues(),
    };
    console.error(formatStartupFailure(error, diagnosticOptions));

    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (cleanupError) {
        console.error(formatStartupFailure(cleanupError, {
          ...diagnosticOptions,
          stage: 'Prisma cleanup after startup failure',
        }));
      }
    }

    process.exitCode = 1;
  }
}

function getSensitiveEnvironmentValues() {
  return Object.entries(process.env)
    .filter(([name, value]) => value && /(?:PASSWORD|TOKEN|SECRET|API[_-]?KEY|ACCESS[_-]?KEY|CREDENTIAL|PRIVATE[_-]?KEY|AUTHORIZATION)/i.test(name))
    .map(([, value]) => value);
}

startServer();
