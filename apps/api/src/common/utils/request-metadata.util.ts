import type { Request } from 'express';
import type { RequestMetadata } from '../interfaces/request-metadata.interface';

const REQUEST_METADATA_DB_VALUE_MAX_LENGTH = 191;

export function getRequestMetadata(request: Request): RequestMetadata {
  return normalizeRequestMetadata({
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  });
}

export function normalizeRequestMetadata(
  metadata: RequestMetadata,
): RequestMetadata {
  return {
    ipAddress: normalizeRequestMetadataValue(metadata.ipAddress),
    userAgent: normalizeRequestMetadataValue(metadata.userAgent),
  };
}

function normalizeRequestMetadataValue(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length <= REQUEST_METADATA_DB_VALUE_MAX_LENGTH) {
    return normalizedValue;
  }

  return normalizedValue.slice(0, REQUEST_METADATA_DB_VALUE_MAX_LENGTH);
}
