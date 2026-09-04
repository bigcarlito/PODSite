export class StoreError extends Error {
  code: string;
  field?: string;
  status: number;

  constructor(
    code: string,
    message: string,
    options?: { field?: string; status?: number }
  ) {
    super(message);
    this.code = code;
    this.field = options?.field;
    this.status = options?.status ?? 400;
  }
}

export function notFound(what: string): StoreError {
  return new StoreError("NOT_FOUND", `${what} not found`, { status: 404 });
}
