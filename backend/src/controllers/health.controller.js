export function getHealth(_request, response) {
  response.status(200).json({ status: 'ok' });
}

export async function getReadiness(request, response) {
  try {
    await request.app.locals.prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ status: 'ready' });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      code: 'DATABASE_NOT_READY',
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
    }));
    response.status(503).json({ status: 'unavailable' });
  }
}
