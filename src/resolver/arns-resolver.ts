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
import { ANT, AOProcess, AoClient, AoIORead } from '@ar.io/sdk';
import { connect } from '@permaweb/aoconnect';
import winston from 'winston';

import * as config from '../config.js';
import { ArNSResolvedData } from '../types.js';

export interface NameResolver {
  resolve(name: string): Promise<ArNSResolvedData | undefined>;
}

export class ArNSResolver implements NameResolver {
  private ao: AoClient;
  private io: AoIORead;
  private logger: winston.Logger;

  constructor({
    io,
    ao = connect({
      MU_URL: config.AO_MU_URL,
      CU_URL: config.AO_CU_URL,
      GRAPHQL_URL: config.AO_GRAPHQL_URL,
      GATEWAY_URL: config.AO_GATEWAY_URL,
    }),
    log,
  }: {
    io: AoIORead;
    ao: AoClient;
    log: winston.Logger;
  }) {
    this.ao = ao;
    this.io = io;
    this.logger = log.child({ class: this.constructor.name });
  }

  async resolve(name: string): Promise<ArNSResolvedData | undefined> {
    this.logger.debug('Resolving name', { name });
    const apexName = name.split('_').slice(-1)[0];
    const record = await this.io.getArNSRecord({ name: apexName });

    if (!record) {
      this.logger.debug('No record found', { name, apexName });
      return undefined;
    }

    // get the ant id and use that to get the record from the cache
    const antId = record.processId;
    const ant = ANT.init({
      process: new AOProcess({
        processId: antId,
        ao: this.ao,
      }),
    });
    const undername = name.split('_').slice(0, -1).join('_') || '@';
    const antRecord = await ant.getRecord({ undername });
    if (!antRecord) {
      return undefined;
    }

    const owner = await ant.getOwner();

    this.logger.debug('Resolved name', {
      name,
      antId,
      antRecord,
      owner,
    });

    return {
      ttlSeconds: antRecord.ttlSeconds,
      txId: antRecord.transactionId,
      processId: antId,
      type: record.type,
      owner,
    };
  }
}
