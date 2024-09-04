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

import { KVBufferStore } from '../types.js';

export class ArNSStore implements KVBufferStore {
  private log: winston.Logger;
  private prefix: string;
  private kvStore: KVBufferStore;

  constructor({
    log,
    kvStore,
    prefix = 'ArNS',
  }: {
    log: winston.Logger;
    kvStore: KVBufferStore;
    prefix?: string;
  }) {
    this.log = log.child({ class: this.constructor.name });
    this.kvStore = kvStore;
    this.prefix = prefix;
    this.log.info('ArNSStore initialized', {
      prefix,
      kvStore: kvStore.constructor.name,
    });
  }

  // avoid collisions with other redis keys
  private hashKey(key: string): string {
    return `${this.prefix}|${key}`;
  }

  async get(key: string): Promise<Buffer | undefined> {
    return this.kvStore.get(this.hashKey(key));
  }

  async set(key: string, value: Buffer, ttlSeconds?: number): Promise<void> {
    return this.kvStore.set(this.hashKey(key), value, ttlSeconds);
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
}
