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
import { AOProcess, AoIORead, IO } from '@ar.io/sdk/node';
import { connect } from '@permaweb/aoconnect';

import { ArNSStore } from './cache/arns-store.js';
import * as config from './config.js';
import { createKvStore } from './lib/kv-store.js';
import log from './log.js';

export const contract: AoIORead = IO.init({
  process: new AOProcess({
    processId: config.IO_PROCESS_ID,
    ao: connect({
      // @permaweb/aoconnect defaults will be used if these are not provided
      MU_URL: config.AO_MU_URL,
      CU_URL: config.AO_CU_URL,
      GRAPHQL_URL: config.AO_GRAPHQL_URL,
      GATEWAY_URL: config.AO_GATEWAY_URL,
    }),
  }),
});

export const cache = new ArNSStore({
  log,
  kvStore: createKvStore({
    log,
    type: config.ARNS_CACHE_TYPE,
    path: config.ARNS_CACHE_PATH,
    redisUrl: config.REDIS_CACHE_URL,
  }),
});

// Exception Handlers

process.on('uncaughtException', (error: any) => {
  log.error('Uncaught exception!', {
    error: error?.message,
    stack: error?.stack,
  });
});

process.on('SIGTERM', async () => {
  log.info('SIGTERM received, exiting...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, exiting...');
  await shutdown();
});

export const shutdown = async () => {
  await cache.close();
  process.exit(0);
};
