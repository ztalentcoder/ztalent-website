process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test_db';
process.env.FRONTEND_ORIGIN = 'http://frontend.test';

const { createServer } = await import('node:http');
const { createApp } = await import('../src/app.js');

export { createApp };

export async function withServer(app, run) {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

export function createPrismaStub(query = async () => 1) {
  return {
    $queryRaw: query,
  };
}
