import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './environment.validation';

export class TypedConfigService extends ConfigService<EnvironmentVariables, true> {
  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return super.get(key, { infer: true });
  }

  getOrThrow<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Configuration key "${String(key)}" is not defined`);
    }
    return value;
  }
}
