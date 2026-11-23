export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly debug?: object,
  ) {
    super(message);
    this.name = "AppError";
  }
}
