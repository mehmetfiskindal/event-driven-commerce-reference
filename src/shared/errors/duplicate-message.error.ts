import { NonRetryableError } from './non-retryable.error';

export class DuplicateMessageError extends NonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateMessageError';
  }
}
