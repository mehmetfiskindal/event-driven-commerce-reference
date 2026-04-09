import { randomUUID } from 'node:crypto';

export function createPrefixedId(prefix: string): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);

  return `${prefix}-${suffix}`;
}
