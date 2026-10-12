// Domain errors carry enough meaning for the HTTP layer to pick a status code
// without the domain knowing anything about HTTP.

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found`);
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly issues: ValidationIssue[],
  ) {
    super(message);
  }
}

export class InvalidTransitionError extends DomainError {}

/** Raised when a write lost an optimistic-concurrency race. */
export class ConcurrencyError extends DomainError {}
