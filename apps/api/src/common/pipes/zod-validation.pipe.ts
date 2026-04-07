import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<TSchemaOutput> implements PipeTransform<
  unknown,
  TSchemaOutput
> {
  public constructor(private readonly schema: ZodSchema<TSchemaOutput>) {}

  public transform(value: unknown): TSchemaOutput {
    const parsed = this.schema.safeParse(value);

    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Ошибка валидации данных',
        details: parsed.error.flatten(),
      });
    }

    return parsed.data;
  }
}
