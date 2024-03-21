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
import { ArIO, RemoteContract } from '@ar.io/sdk/node';

import { LmdbKVStore } from './cache/lmdb-kv-store.js';
import * as config from './config.js';
import log from './log.js';

export const network = new ArIO({
  contract: new RemoteContract({
    contractTxId: config.CONTRACT_TX_ID,
    url: config.CONTRACT_CACHE_URL,
  }),
});

export const arnsCache = new LmdbKVStore({
  dbPath: config.ARNS_CACHE_PATH,
});

export async function evaluateArNSNames() {
  log.info('Evaluating arns names');
  // TODO: add evaluation logic here
  return;
}
