import { createPrefixedId } from '../utils/id';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue>;

function normalizeHeaderValue(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getRequestId(input?: {
  requestId?: string;
  headers?: HeaderBag;
}): string {
  if (input?.requestId) {
    return input.requestId;
  }

  const headerRequestId = normalizeHeaderValue(
    input?.headers?.[REQUEST_ID_HEADER],
  );

  if (headerRequestId) {
    return headerRequestId;
  }

  return createPrefixedId('req');
}

export function getCorrelationId(input?: {
  correlationId?: string;
  requestId?: string;
  headers?: HeaderBag;
}): string {
  if (input?.correlationId) {
    return input.correlationId;
  }

  const headerCorrelationId = normalizeHeaderValue(
    input?.headers?.[CORRELATION_ID_HEADER],
  );

  if (headerCorrelationId) {
    return headerCorrelationId;
  }

  return input?.requestId ?? createPrefixedId('corr');
}
