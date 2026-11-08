import { getAuthenticatedAdmin } from '../utils/authenticated-admin.js';

export async function requireAdminAuth(request, _response, next) {
  try {
    request.admin = await getAuthenticatedAdmin(request);
    next();
  } catch (error) {
    next(error);
  }
}
