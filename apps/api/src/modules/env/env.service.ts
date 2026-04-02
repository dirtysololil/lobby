import { Injectable } from '@nestjs/common';
import { parseApiEnv, type ApiEnv } from '@lobby/config';

@Injectable()
export class EnvService {
  private readonly values = parseApiEnv(process.env);

  public getValues(): ApiEnv {
    return this.values;
  }

  public isProduction(): boolean {
    return this.values.NODE_ENV === 'production';
  }
}
