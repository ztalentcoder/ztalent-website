const allowedMethods = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type';

export function createCorsMiddleware(frontendOrigin) {
  return function cors(request, response, next) {
    const requestOrigin = request.get('Origin');
    response.vary('Origin');

    if (requestOrigin === frontendOrigin) {
      response.set('Access-Control-Allow-Origin', frontendOrigin);
      response.set('Access-Control-Allow-Credentials', 'true');
      response.set('Access-Control-Allow-Methods', allowedMethods);
      response.set('Access-Control-Allow-Headers', allowedHeaders);
    }

    if (request.method === 'OPTIONS') {
      return response.status(204).end();
    }

    next();
  };
}
