import { HttpError } from '../utils/http-error.js';

export function requireAdminRole(...allowedRoles) {
  return function adminRoleAuthorization(request, _response, next) {
    if (!request.admin) {
      next(new HttpError(401, 'INVALID_SESSION', 'Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(request.admin.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'You are not authorized to access this resource.'));
      return;
    }

    next();
  };
}
