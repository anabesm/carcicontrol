export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
