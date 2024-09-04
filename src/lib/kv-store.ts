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

import { LmdbKVStore } from '../cache/lmdb-kv-store.js';
import { RedisKvStore } from '../cache/redis-kv-store.js';

function isSupportedKvStoreType(type: string): type is 'lmdb' | 'redis' {
  return type === 'lmdb' || type === 'redis';
}

export const createKvStore = ({
  log,
  type,
  path,
  redisUrl,
  ttlSeconds,
}: {
  log: winston.Logger;
  type: 'lmdb' | 'redis' | string;
  path: string;
  redisUrl: string;
  ttlSeconds?: number;
}) => {
  if (!isSupportedKvStoreType(type)) {
    throw new Error(`Unknown kv store type: ${type}`);
  }
  switch (type) {
    case 'lmdb':
      return new LmdbKVStore({ dbPath: path, ttlSeconds });
    case 'redis':
      return new RedisKvStore({ redisUrl, log });
    default:
      throw new Error(`Unknown kv store type: ${type}`);
  }
};
