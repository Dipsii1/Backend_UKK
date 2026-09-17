export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly errors?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validasi gagal", errors?: unknown) {
    super(422, "VALIDATION_ERROR", message, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Tidak diizinkan") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Dilarang") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Tidak ditemukan") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Konflik") {
    super(409, "CONFLICT", message);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Kesalahan server internal", errors?: unknown) {
    super(500, "INTERNAL_ERROR", message, errors);
  }
}