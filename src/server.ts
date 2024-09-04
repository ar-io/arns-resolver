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
import { ANT, AOProcess } from '@ar.io/sdk/node';
import { connect } from '@permaweb/aoconnect';
import cors from 'cors';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import * as config from './config.js';
import log from './log.js';
import { cache, contract } from './system.js';
import { ArNSResolvedData } from './types.js';

// HTTP server
export const app = express();

// CORS
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'POST'],
  }),
);

app.get('/', (_req, res) => {
  res.redirect('/ar-io/resolver/info');
});

// OpenAPI spec
const openapiDocument = YAML.parse(
  fs.readFileSync('docs/openapi.yaml', 'utf8'),
);
app.get(['/openapi.json', '/ar-io/resolver/openapi.json'], (_req, res) => {
  res.json(openapiDocument);
});

// Swagger UI
app.use(
  ['/api-docs', '/ar-io/resolver/api-docs'],
  swaggerUi.serve,
  swaggerUi.setup(openapiDocument, {
    explorer: true,
  }),
);

if (config.ENABLE_OPENAPI_VALIDATION) {
  app.use(
    OpenApiValidator.middleware({
      apiSpec: './docs/openapi.yaml',
      validateRequests: true, // (default)
      validateResponses: false, // false by default
    }),
  );
}

app.get('/ar-io/resolver/healthcheck', async (_req, res) => {
  const data = {
    uptime: process.uptime(),
    date: new Date(),
    message: 'Welcome to the Permaweb.',
  };

  res.status(200).send(data);
});

app.get('/ar-io/resolver/info', (_req, res) => {
  res.status(200).send({
    processId: config.IO_PROCESS_ID,
  });
});

app.get('/ar-io/resolver/records/:name', async (req, res) => {
  const arnsName = req.params.name;

  // THIS IS ESSENTIALLY A READ THROUGH CACHE USING REDIS - TODO: could replace this with a resolver interface with read through logic
  try {
    const logger = log.child({ arnsName });
    logger.debug('Checking cache for record...');

    let resolvedRecordData: ArNSResolvedData | undefined;
    const cachedNameResolution = await cache.get(arnsName);
    if (cachedNameResolution) {
      logger.debug('Found cached arns name resolution');
      resolvedRecordData = JSON.parse(cachedNameResolution.toString());
    } else {
      logger.debug('Cache miss for arns name');
      const apexName = arnsName.split('_').slice(-1)[0];
      const record = await contract.getArNSRecord({ name: apexName });
      if (!record) {
        res.status(404).json({
          error: 'Record not found',
        });
        return;
      }

      // get the ant id and use that to get the record from the cache
      const antId = record.processId;
      const ant = ANT.init({
        process: new AOProcess({
          processId: antId,
          ao: connect({
            MU_URL: config.AO_MU_URL,
            CU_URL: config.AO_CU_URL,
            GRAPHQL_URL: config.AO_GRAPHQL_URL,
            GATEWAY_URL: config.AO_GATEWAY_URL,
          }),
        }),
      });
      const undername = arnsName.split('_').slice(0, -1).join('_') || '@';
      const antRecord = await ant.getRecord({ undername });
      if (!antRecord) {
        res.status(404).json({
          error: 'Record not found',
        });
        return;
      }
      const owner = await ant.getOwner();
      resolvedRecordData = {
        ttlSeconds: antRecord.ttlSeconds,
        txId: antRecord.transactionId,
        processId: antId,
        type: record.type,
        owner,
      };

      const resolvedRecordBuffer = Buffer.from(
        JSON.stringify(resolvedRecordData),
      );

      // cache the record in the cache
      await cache.set(
        arnsName,
        resolvedRecordBuffer,
        resolvedRecordData.ttlSeconds,
      );
    }

    if (!resolvedRecordData) {
      res.status(404).json({
        error: 'Record not found',
      });
      return;
    }

    logger.debug('Successfully fetched record from cache', {
      name: arnsName,
      txId: resolvedRecordData.txId,
      ttlSeconds: resolvedRecordData.ttlSeconds,
    });
    res
      .status(200)
      .set({
        'Cache-Control': `public, max-age=${resolvedRecordData.ttlSeconds}`,
        'Content-Type': 'application/json',
        'X-ArNS-Resolved-Id': resolvedRecordData.txId,
        'X-ArNS-Ttl-Seconds': resolvedRecordData.ttlSeconds,
        'X-ArNS-Process-Id': resolvedRecordData.processId,
      })
      .json({
        ...resolvedRecordData,
        name: arnsName,
      });
  } catch (err: any) {
    log.error('Failed to get record', {
      name: arnsName,
      message: err?.message,
      stack: err?.stack,
    });
    res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});
