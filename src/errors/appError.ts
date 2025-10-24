export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Base application error for all domain + system failures.
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'INTERNAL_ERROR',
    public status: number = 500,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 'BAD_REQUEST', 400, details);
  }

  static notFound(message: string, details?: unknown) {
    return new AppError(message, 'NOT_FOUND', 404, details);
  }

  static internal(message: string, details?: unknown) {
    return new AppError(message, 'INTERNAL_ERROR', 500, details);
  }

  static validation(fields: FieldError[]) {
    return new ValidationError(fields);
  }
}

/**
 * Specialized subclass for aggregated validation errors.
 * Mirrors TSOA's built-in field-level error structure.
 */
export class ValidationError extends AppError {
  constructor(public fields: FieldError[]) {
    super('Validation failed', 'VALIDATION_ERROR', 400, { fields });
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
