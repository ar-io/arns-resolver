/**
 * AR.IO ArNS Resolver
 * Copyright (C) 2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { RedisClientType, commandOptions, createClient } from 'redis';
import winston from 'winston';

import { KVBufferStore } from '../types.js';

export class RedisKvStore implements KVBufferStore {
  private client: RedisClientType;
  private log: winston.Logger;
  private defaultTtlSeconds?: number;

  constructor({ log, redisUrl }: { log: winston.Logger; redisUrl: string }) {
    this.log = log.child({ class: this.constructor.name });
    this.client = createClient({
      url: redisUrl,
    });
    this.client.on('error', (error: any) => {
      this.log.error(`Redis error`, {
        message: error.message,
        stack: error.stack,
      });
      // TODO: add prometheus metric for redis error
    });
    this.client.connect().catch((error: any) => {
      this.log.error(`Redis connection error`, {
        message: error.message,
        stack: error.stack,
      });
      // TODO: add prometheus metric for redis connection error
    });
  }

  async close() {
    await this.client.quit();
  }

  async get(key: string): Promise<Buffer | undefined> {
    const value = await this.client.get(
      commandOptions({ returnBuffers: true }),
      key,
    );
    return value ?? undefined;
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async del(key: string): Promise<void> {
    if (await this.has(key)) {
      await this.client.del(key);
    }
  }

  async set(key: string, buffer: Buffer, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, buffer, {
        EX: ttlSeconds ?? this.defaultTtlSeconds,
      });
    } else {
      await this.client.set(key, buffer);
    }
  }
}
