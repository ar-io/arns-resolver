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
import { LmdbKVStore } from './lmdb-kv-store.js';

describe('LmdbKVStore', () => {
  const cache = new LmdbKVStore({
    dbPath: './data/test',
    ttlSeconds: 1,
  });

  it('should set and get value', async () => {
    await cache.set('test', Buffer.from('hello'));
    const value = await cache.get('test');
    expect(value).toEqual(Buffer.from('hello'));
  });

  it('should remove a value once ttl has expired', async () => {
    await cache.set('expire', Buffer.from('hello'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const value = await cache.get('expire');
    expect(value).toBeUndefined();
  });
});
