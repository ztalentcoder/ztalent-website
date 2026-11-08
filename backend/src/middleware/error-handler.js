import { HttpError } from '../utils/http-error.js';

const parserErrors = {
  'entity.parse.failed': {
    status: 400,
    code: 'INVALID_JSON',
    message: 'Request body contains invalid JSON.',
  },
  'entity.too.large': {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request body exceeds the allowed size.',
  },
};

function getErrorDetails(error) {
  if (parserErrors[error?.type]) {
    return parserErrors[error.type];
  }

  if (error instanceof HttpError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  };
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const details = getErrorDetails(error);
  console.error(JSON.stringify({
    level: 'error',
    code: details.code,
    errorName: typeof error?.name === 'string' ? error.name : 'Error',
    method: request.method,
    path: request.path,
    status: details.status,
  }));

  response.status(details.status).json({
    error: {
      code: details.code,
      message: details.status === 500 && process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : details.message,
    },
  });
}
