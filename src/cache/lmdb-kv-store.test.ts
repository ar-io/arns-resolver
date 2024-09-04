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
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { LmdbKVStore } from './lmdb-kv-store.js';

describe('LmdbKVStore', () => {
  const cache = new LmdbKVStore({
    dbPath: './data/test',
    ttlSeconds: 1,
  });

  it('should set and get value with default ttl', async () => {
    await cache.set('test', Buffer.from('hello'));
    const value = await cache.get('test');
    assert.deepEqual(value, Buffer.from('hello'));
  });

  it('should remove a value once default ttl has expired ', async () => {
    await cache.set('expire', Buffer.from('hello'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const value = await cache.get('expire');
    assert.strictEqual(value, undefined);
  });

  it('should override the default ttl when a ttl is provided when setting a record', async () => {
    await cache.set('test', Buffer.from('hello'), 3);
    // get it right away
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const value = await cache.get('test');
    assert.deepEqual(value, Buffer.from('hello'));
    // wait for it to expire
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const value2 = await cache.get('test');
    assert.strictEqual(value2, undefined);
  });
});
