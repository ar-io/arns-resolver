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
import { RootDatabase, open } from 'lmdb';

import { KVBufferStore } from '../types.js';

export class LmdbKVStore implements KVBufferStore {
  private db: RootDatabase<Buffer, string>;
  private ttlSeconds: number | undefined;

  constructor({ dbPath, ttlSeconds }: { dbPath: string; ttlSeconds?: number }) {
    this.db = open({
      path: dbPath,
      encoding: 'binary',
      commitDelay: 100, // 100ms delay - increases writes per transaction to reduce I/O
    });
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Attach the TTL to the value.
   */
  private serialize(value: Buffer): Buffer {
    if (this.ttlSeconds === undefined) return value;
    const buffer = Buffer.from(`${this.ttlSeconds}`);
    return Buffer.concat([buffer, value]);
  }

  /**
   * Deserialize the value and check the TTL before returning.
   */
  private deserialize(value: Buffer): Buffer | undefined {
    if (this.ttlSeconds === undefined) return value;
    const ttl = value.readUInt32BE(0);
    if (ttl < Date.now()) {
      return undefined;
    }
    return value.slice(4);
  }

  /**
   * Get the value from the database and check the TTL.
   * If the TTL has expired, remove the key.
   */
  async get(key: string): Promise<Buffer | undefined> {
    const value = await this.db.get(key);
    if (!value) {
      return undefined;
    }
    const buffer = this.deserialize(value);
    if (!buffer) {
      await this.del(key);
      return undefined;
    }
    return value;
  }

  /**
   * Check if the key exists in the database.
   */
  async has(key: string): Promise<boolean> {
    return this.db.doesExist(key);
  }

  /**
   * Remove the key from the database.
   */
  async del(key: string): Promise<void> {
    if (await this.has(key)) {
      await this.db.remove(key);
    }
  }

  /**
   * Set the value in the database with the TTL.
   */
  async set(key: string, buffer: Buffer): Promise<void> {
    await this.db.put(key, this.serialize(buffer));
  }
}
