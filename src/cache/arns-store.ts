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
import winston from 'winston';

import * as metrics from '../metrics.js';
import { NameResolver } from '../resolver/arns-resolver.js';
import { ArNSResolvedData, KVBufferStore } from '../types.js';

export class ArNSStore implements KVBufferStore, NameResolver {
  private log: winston.Logger;
  private prefix: string;
  private kvStore: KVBufferStore;
  private resolver: NameResolver;

  constructor({
    log,
    resolver,
    kvStore,
    prefix = 'ArNS',
  }: {
    log: winston.Logger;
    resolver: NameResolver;
    kvStore: KVBufferStore;
    prefix?: string;
  }) {
    this.log = log.child({ class: this.constructor.name });
    this.resolver = resolver;
    this.kvStore = kvStore;
    this.prefix = prefix;
    this.log.info('ArNSStore initialized', {
      prefix,
      kvStore: kvStore.constructor.name,
      resolver: resolver.constructor.name,
    });
  }

  // avoid collisions with other redis keys
  private hashKey(key: string): string {
    return `${this.prefix}|${key}`;
  }

  private serialize(buffer: Buffer, ttlSeconds: number): Buffer {
    const expirationBuffer = Buffer.allocUnsafe(8);
    expirationBuffer.writeBigInt64BE(BigInt(Date.now() + ttlSeconds * 1000), 0);
    const ttlBuffer = Buffer.allocUnsafe(8);
    ttlBuffer.writeBigInt64BE(BigInt(ttlSeconds * 1000), 0);
    return Buffer.concat([expirationBuffer, ttlBuffer, buffer]);
  }

  private deserialize(buffer: Buffer): {
    expired: boolean;
    buffer: Buffer;
    ttlSeconds: number;
  } {
    const expirationTimestamp = buffer.readBigInt64BE(0); // 8 bytes for a timestamp
    const ttlMilliseconds = buffer.readBigInt64BE(8); // 8 bytes for a timestamp
    return {
      expired: Date.now() >= Number(expirationTimestamp),
      ttlSeconds: Number(ttlMilliseconds) / 1000,
      buffer: buffer.slice(16),
    };
  }

  async get(key: string): Promise<Buffer | undefined> {
    const result = await this.getWithExpirationData(key);
    if (result === undefined || result.expired) {
      return undefined;
    }
    return result.buffer;
  }

  private async getWithExpirationData(key: string): Promise<
    | {
        buffer: Buffer;
        ttlSeconds: number;
        expired: boolean;
      }
    | undefined
  > {
    const result = await this.kvStore.get(this.hashKey(key));
    if (result === undefined) {
      metrics.arnsCacheMiss.inc({
        cache_type: this.kvStore.constructor.name,
      });
      return undefined;
    }
    metrics.arnsCacheHit.inc({
      cache_type: this.kvStore.constructor.name,
    });

    return this.deserialize(result);
  }

  async set(key: string, value: Buffer, ttlSeconds: number): Promise<void> {
    const serialized = this.serialize(value, ttlSeconds);
    return this.kvStore.set(this.hashKey(key), serialized);
  }

  async del(key: string): Promise<void> {
    return this.kvStore.del(this.hashKey(key));
  }

  async has(key: string): Promise<boolean> {
    return this.kvStore.has(this.hashKey(key));
  }

  async close(): Promise<void> {
    return this.kvStore.close();
  }

  /**
   * Resolves a name and updates the cache if it's expired.
   * @param key - The name to resolve.
   * @returns The resolved name data.
   */
  async resolve(key: string): Promise<ArNSResolvedData | undefined> {
    const cachedWithExpirationData = await this.getWithExpirationData(key);
    if (cachedWithExpirationData !== undefined) {
      if (cachedWithExpirationData.expired) {
        this.log.debug('Cache expired, resolving name', { key });
        try {
          const resolved = await this.resolver.resolve(key);
          if (resolved) {
            await this.set(
              key,
              Buffer.from(JSON.stringify(resolved)),
              resolved.ttlSeconds,
            );
            this.log.debug('Updated cache', {
              key,
              ttlSeconds: resolved.ttlSeconds,
            });
            return resolved;
          }
        } catch (error: any) {
          this.log.error('Error resolving name. Falling back to cache', {
            key,
            message: error.message,
            stack: error.stack,
          });
        }
      }
      return JSON.parse(cachedWithExpirationData.buffer.toString());
    }

    // if not in cache, resolve it
    const resolved = await this.resolver.resolve(key);
    if (!resolved) {
      return undefined;
    }
    // update the cache with the resolved data
    await this.set(
      key,
      Buffer.from(JSON.stringify(resolved)),
      resolved.ttlSeconds,
    );
    this.log.debug('Updated cache', { key, ttlSeconds: resolved.ttlSeconds });
    return resolved;
  }
}
