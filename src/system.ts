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
import { ANT, ANTRecord, ArIO, RemoteContract } from '@ar.io/sdk/node';

import { LmdbKVStore } from './cache/lmdb-kv-store.js';
import * as config from './config.js';
import log from './log.js';
import { ContractTxId } from './types.js';

export let lastEvaluationTime = 0;
export const contract = new ArIO({
  contract: new RemoteContract({
    contractTxId: config.CONTRACT_TX_ID,
    url: config.CONTRACT_CACHE_URL,
  }),
});

export const getLastEvaluationTime = () => lastEvaluationTime;
// TODO: this could be done using any KV store - or in memory. For now, we are using LMDB for persistence.
export const cache = new LmdbKVStore({
  dbPath: config.ARNS_CACHE_PATH,
});

export async function evaluateArNSNames() {
  log.info('Evaluating arns names');

  const startTime = Date.now();
  const apexRecords = await contract.getArNSRecords();
  log.info('Retrieved apex records:', {
    count: Object.keys(apexRecords).length,
  });

  // get all the unique contract tx ids
  const contractTxIds: Set<string> = new Set(
    Object.values(apexRecords).map((record) => record.contractTxId),
  );

  // create a map of the contract records for O(1) lookup
  const contractRecordMap: Record<ContractTxId, Record<string, ANTRecord>> = {};
  await Promise.all(
    [...contractTxIds].map(async (contractTxId) => {
      const antContract = new ANT({ contractTxId });
      const antRecords = await antContract.getRecords().catch((err) => {
        log.error('Failed to get records for contract', {
          contractTxId,
          error: err,
        });
        return {};
      });

      if (antRecords) {
        contractRecordMap[contractTxId] = antRecords;
      }
    }),
  );

  log.info('Retrieved contract tx ids assigned to records:', {
    contractCount: Object.keys(contractRecordMap).length,
  });

  // now go through all the record names and assign them to the resolved tx ids
  for (const [apexName, apexRecordData] of Object.entries(apexRecords)) {
    const contractRecords = contractRecordMap[apexRecordData.contractTxId];
    const ant = new ANT({ contractTxId: apexRecordData.contractTxId });
    // TODO: current complexity is O(n^2) - we can do better by flattening records above before this loop
    for (const [antName, antRecordData] of Object.entries(contractRecords)) {
      const resolvedRecordObj = {
        ttlSeconds: antRecordData.ttlSeconds,
        txId: antRecordData.transactionId,
        contractTxId: apexRecordData.contractTxId,
        type: apexRecordData.type,
        owner: await ant.getOwner(),
        ...(apexRecordData.type === 'lease' && {
          endTimestamp: apexRecordData.endTimestamp,
        }),
      };
      const resolvedRecordBuffer = Buffer.from(
        JSON.stringify(resolvedRecordObj),
      );
      if (antName === '@') {
        cache.set(apexName, resolvedRecordBuffer);
      } else {
        cache.set(`${antName}_${apexName}`, resolvedRecordBuffer);
      }
    }
  }
  log.info('Successfully evaluated arns names', {
    durationMs: Date.now() - startTime,
  });
  lastEvaluationTime = Date.now();
  return;
}
