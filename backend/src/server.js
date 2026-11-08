import { createServer } from 'node:http';

async function startServer() {
  let prisma;
  let server;

  try {
    const { config } = await import('./config/environment.js');
    const [{ default: app }, database] = await Promise.all([
      import('./app.js'),
      import('./config/database.js'),
    ]);

    prisma = database.prisma;
    await prisma.$connect();

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
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        console.error('Failed to disconnect from the database cleanly.');
      }
    }

    if (error?.code === 'BACKEND_CONFIG_INVALID') {
      console.error(error.message);
    } else {
      console.error('Backend startup failed. Check the database connection and server configuration.');
    }
    process.exitCode = 1;
  }
}

startServer();
