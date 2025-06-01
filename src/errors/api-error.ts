export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code?: string): ApiError {
    return new ApiError(message, 400, code);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string): ApiError {
    return new ApiError(message, 401, code);
  }

  static forbidden(message: string = 'Forbidden', code?: string): ApiError {
    return new ApiError(message, 403, code);
  }

  static notFound(message: string = 'Not found', code?: string): ApiError {
    return new ApiError(message, 404, code);
  }

  static conflict(message: string, code?: string): ApiError {
    return new ApiError(message, 409, code);
  }

  static tooManyRequests(message: string = 'Too many requests', code?: string): ApiError {
    return new ApiError(message, 429, code);
  }

  static internal(message: string = 'Internal server error', code?: string): ApiError {
    return new ApiError(message, 500, code);
  }

  static serviceUnavailable(message: string = 'Service unavailable', code?: string): ApiError {
    return new ApiError(message, 503, code);
  }

  toJSON(): object {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}
