export class InvalidCredentialsError extends Error {
  constructor() {
    super('INVALID_CREDENTIALS!');
    this.name = 'InvalidCredentialsError';
  }
}
