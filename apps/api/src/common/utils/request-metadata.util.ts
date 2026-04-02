import type { Request } from 'express';
import type { RequestMetadata } from '../interfaces/request-metadata.interface';

export function getRequestMetadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}
