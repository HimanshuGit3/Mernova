/** An expected, client-facing error. The error handler turns it into the one error shape. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message = 'Invalid request', details, code = 'VALIDATION_ERROR') {
    return new ApiError(400, code, message, details);
  }
  static unauthenticated(message = 'Sign in to continue', code = 'UNAUTHENTICATED') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'You are not allowed to do this', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'Conflict', code = 'CONFLICT', details) {
    return new ApiError(409, code, message, details);
  }
}
