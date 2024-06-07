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
  ANTState,
  AoIORead,
  IO,
  RemoteContract,
} from '@ar.io/sdk/node';
import pLimit from 'p-limit';

import { LmdbKVStore } from './cache/lmdb-kv-store.js';
import * as config from './config.js';
import log from './log.js';
import { ContractTxId } from './types.js';

let lastEvaluationTimestamp: number | undefined;
export const getLastEvaluatedTimestamp = () => lastEvaluationTimestamp;
export const contract: AoIORead = IO.init({
  processId: config.IO_PROCESS_ID,
});

// TODO: this could be done using any KV store - or in memory. For now, we are using LMDB for persistence.
export const cache = new LmdbKVStore({
  dbPath: config.ARNS_CACHE_PATH,
  ttlSeconds: config.EVALUATION_INTERVAL_MS / 1000,
});

const parallelLimit = pLimit(100);

export async function evaluateArNSNames() {
  log.info('Evaluating arns names');

  const startTime = Date.now();
  const apexRecords = await contract.getArNSRecords();
  log.info('Retrieved apex records:', {
    count: Object.keys(apexRecords).length,
  });

  // get all the unique process ids on the contract
  const contractTxIds: Set<string> = new Set(
    // TODO: replace with process ids
    Object.values(apexRecords).map((record) => record.contractTxId),
  );

  // create a map of the contract records and use concurrency to fetch their records
  const contractRecordMap: Record<
    ContractTxId,
    { owner: string | undefined; records: Record<string, ANTRecord> }
  > = {};
  await Promise.all(
    [...contractTxIds].map((contractTxId) => {
      return parallelLimit(async () => {
        // TODO: replace with ao processes configuration
        const antContract = ANT.init({
          contract: new RemoteContract<ANTState>({
            contractTxId,
            cacheUrl: config.CONTRACT_CACHE_URL,
          }),
        });
        const antRecords = await antContract.getRecords().catch((err: any) => {
          log.debug('Failed to get records for contract', {
            contractTxId,
            error: err,
          });
          return {};
        });

        if (Object.keys(antRecords).length) {
          contractRecordMap[contractTxId] = {
            owner: await antContract.getOwner().catch((err: any) => {
              log.debug('Failed to get owner for contract', {
                contractTxId,
                error: err,
              });
              return undefined;
            }),
            records: antRecords,
          };
        }
      });
    }),
  );

  log.info('Retrieved contract tx ids assigned to records:', {
    contractCount: Object.keys(contractRecordMap).length,
  });

  // filter out any records associated with an invalid contract
  const validArNSRecords = Object.entries(apexRecords).filter(
    ([_, record]) => record.contractTxId in contractRecordMap,
  );

  const insertPromises = [];

  // now go through all the record names and assign them to the resolved tx ids
  for (const [apexName, apexRecordData] of validArNSRecords) {
    const antData = contractRecordMap[apexRecordData.contractTxId];
    // TODO: current complexity is O(n^2) - we can do better by flattening records above before this loop
    for (const [antName, antRecordData] of Object.entries(antData.records)) {
      const resolvedRecordObj = {
        ttlSeconds:
          antRecordData.ttlSeconds || config.EVALUATION_INTERVAL_MS / 1000,
        // TODO: deprecate support for legacy ANTs
        txId: antRecordData.transactionId ?? antRecordData,
        contractTxId: apexRecordData.contractTxId,
        type: apexRecordData.type,
        owner: antData.owner,
        ...(apexRecordData.type === 'lease' && {
          endTimestamp: apexRecordData.endTimestamp,
        }),
      };
      const resolvedRecordBuffer = Buffer.from(
        JSON.stringify(resolvedRecordObj),
      );
      const cacheKey = antName === '@' ? apexName : `${antName}_${apexName}`;
      // all inserts will get a ttl based on the cache configuration
      const promise = cache.set(cacheKey, resolvedRecordBuffer).catch((err) => {
        log.error('Failed to set record in cache', {
          cacheKey,
          error: err,
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
  return;
}
