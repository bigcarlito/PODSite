export class StoreError extends Error {
  code: string;
  field?: string;
  status: number;
  /**
   * Optional diagnostic payload serialized alongside the error. Use it
   * when knowing *why* the call failed requires data the message can't
   * carry — so a caller can correct course without a second round-trip.
   */
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: {
      field?: string;
      status?: number;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.code = code;
    this.field = options?.field;
    this.status = options?.status ?? 400;
    this.details = options?.details;
  }
}

export function notFound(what: string): StoreError {
  return new StoreError("NOT_FOUND", `${what} not found`, { status: 404 });
}
