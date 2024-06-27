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
import {
  ANT,
  ANTRecord,
  AoIORead,
  IO,
  ProcessId,
  isLeasedArNSRecord,
} from '@ar.io/sdk/node';
import pLimit from 'p-limit';

import { LmdbKVStore } from './cache/lmdb-kv-store.js';
import * as config from './config.js';
import log from './log.js';
import { ArNSResolvedData } from './types.js';

let lastEvaluationTimestamp: number | undefined;
let evaluationInProgress = false;
export const getLastEvaluatedTimestamp = () => lastEvaluationTimestamp;
export const contract: AoIORead = IO.init({
  processId: config.IO_PROCESS_ID,
});

// TODO: this could be done using any KV store - or in memory. For now, we are using LMDB for persistence.
export const cache = new LmdbKVStore({
  dbPath: config.ARNS_CACHE_PATH,
  ttlSeconds: config.ARNS_CACHE_TTL_MS / 1000,
});

const parallelLimit = pLimit(100);

export async function evaluateArNSNames() {
  if (evaluationInProgress) {
    log.debug('Evaluation in progress', {
      processId: config.IO_PROCESS_ID,
    });
    return;
  }

  try {
    log.info('Evaluating arns names against ArNS registry', {
      processId: config.IO_PROCESS_ID,
    });
    // prevent duplicate evaluations
    evaluationInProgress = true;

    // monitor the time it takes to evaluate the names
    const startTime = Date.now();
    const apexRecords = await contract.getArNSRecords();
    log.info('Retrieved apex records:', {
      count: Object.keys(apexRecords).length,
    });

    // get all the unique process ids on the contract
    const processIds: Set<string> = new Set(
      Object.values(apexRecords)
        .map((record) => record.processId)
        .filter((id) => id !== undefined),
    );

    log.debug('Identified unique process ids assigned to records:', {
      recordCount: Object.keys(apexRecords).length,
      processCount: processIds.size,
    });

    // create a map of the contract records and use concurrency to fetch their records
    const processRecordMap: Record<
      ProcessId,
      { owner: string | undefined; records: Record<string, ANTRecord> }
    > = {};
    await Promise.all(
      [...processIds].map((processId: string) => {
        return parallelLimit(async () => {
          const antContract = ANT.init({
            processId,
          });
          const antRecords = await antContract
            .getRecords()
            .catch((err: any) => {
              log.debug('Failed to get records for contract', {
                processId,
                error: err?.message,
                stack: err?.stack,
              });
              return {};
            });

          if (Object.keys(antRecords).length) {
            processRecordMap[processId] = {
              owner: await antContract.getOwner().catch((err: any) => {
                log.debug('Failed to get owner for contract', {
                  processId,
                  error: err?.message,
                  stack: err?.stack,
                });
                return undefined;
              }),
              records: antRecords,
            };
          }
        });
      }),
    );

    log.info('Retrieved unique process ids assigned to records:', {
      processCount: Object.keys(processRecordMap).length,
    });

    // filter out any records associated with an invalid contract
    const validArNSRecords = Object.entries(apexRecords).filter(
      ([_, record]) => record.processId in processRecordMap,
    );

    const insertPromises = [];

    // now go through all the record names and assign them to the resolved tx ids
    for (const [apexName, apexRecordData] of validArNSRecords) {
      const antData = processRecordMap[apexRecordData.processId];
      // TODO: current complexity is O(n^2) - we can do better by flattening records above before this loop
      for (const [undername, antRecordData] of Object.entries(
        antData.records,
      )) {
        const resolvedRecordObj: ArNSResolvedData = {
          ttlSeconds: antRecordData.ttlSeconds,
          txId: antRecordData.transactionId,
          processId: apexRecordData.processId,
          type: apexRecordData.type,
          owner: antData.owner,
          ...(isLeasedArNSRecord(apexRecordData)
            ? {
                endTimestamp: apexRecordData.endTimestamp,
              }
            : {}),
        };
        const resolvedRecordBuffer = Buffer.from(
          JSON.stringify(resolvedRecordObj),
        );
        const cacheKey =
          undername === '@' ? apexName : `${undername}_${apexName}`;
        log.debug('Inserting resolved record data into cache', {
          apexName,
          undername,
          resolvedName: cacheKey,
          processId: apexRecordData.processId,
          txId: antRecordData.transactionId,
        });
        // all inserts will get a ttl based on the cache configuration
        const promise = cache
          .set(cacheKey, resolvedRecordBuffer)
          .catch((err) => {
            log.error('Failed to set record in cache', {
              cacheKey,
              error: err?.message,
              stack: err?.stack,
            });
          });
        insertPromises.push(promise);
      }
    }
    // use pLimit to prevent overwhelming cache
    await Promise.all(
      insertPromises.map((promise) => parallelLimit(() => promise)),
    );
    log.info('Successfully evaluated arns names', {
      durationMs: Date.now() - startTime,
    });
    lastEvaluationTimestamp = Date.now();
  } catch (err: any) {
    log.error('Failed to evaluate arns names', {
      error: err?.message,
      stack: err?.stack,
    });
  } finally {
    evaluationInProgress = false;
  }

  return;
}
