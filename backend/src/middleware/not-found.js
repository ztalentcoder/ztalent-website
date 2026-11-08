import { HttpError } from '../utils/http-error.js';

export function notFound(_request, _response, next) {
  next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.'));
}
