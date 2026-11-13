const sensitiveFieldPattern = /\b((?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|client[_-]?secret|authorization|credential|private[_-]?key|cookie))\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi;
const sensitiveQueryPattern = /([?&](?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|client[_-]?secret)=)[^&\s#]+/gi;

export function formatStartupFailure(error, {
  stage = 'startup',
  port,
  databaseUrl,
  sensitiveValues = [],
} = {}) {
  const name = typeof error?.name === 'string' ? error.name : 'Error';
  const code = typeof error?.code === 'string' || typeof error?.code === 'number'
    ? String(error.code)
    : undefined;
  const rawMessage = typeof error?.message === 'string' ? error.message : String(error ?? 'Unknown error');
  let message = sanitizeMessage(rawMessage, databaseUrl, sensitiveValues);

  if (code === 'EADDRINUSE') {
    message = `The configured port is already occupied. ${message}`;
  }

  const portContext = Number.isInteger(port) ? ` (configured port ${port})` : '';
  const codeContext = code ? ` [${code}]` : '';
  return `Backend startup failed during ${stage}${portContext}: ${name}${codeContext}: ${message}`;
}

function sanitizeMessage(message, databaseUrl, sensitiveValues) {
  let safeMessage = message;

  if (databaseUrl) {
    safeMessage = safeMessage.replaceAll(databaseUrl, '[REDACTED_DATABASE_URL]');
  }

  for (const value of sensitiveValues) {
    if (typeof value === 'string' && value.length > 0) {
      safeMessage = safeMessage.replaceAll(value, '[REDACTED]');
    }
  }

  return safeMessage
    .replace(/((?:postgres(?:ql)?):\/\/)[^/\s@]+@/gi, '$1[REDACTED]@')
    .replace(sensitiveQueryPattern, '$1[REDACTED]')
    .replace(/\b(authorization)\s*:\s*Bearer\s+[^\s,;]+/gi, '$1: [REDACTED]')
    .replace(sensitiveFieldPattern, '$1$2[REDACTED]');
}
