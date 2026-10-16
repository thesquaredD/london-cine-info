export class AccountError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAt: number | null = null,
  ) {
    super(message);
  }
}
