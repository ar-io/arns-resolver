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
import cors from 'cors';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import * as config from './config.js';
import log from './log.js';
import { cache, getLastEvaluatedTimestamp } from './system.js';

// HTTP server
export const app = express();

// CORS
app.use(
  cors({
    origin: '*',
    methods: ['GET'],
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
    contractId: config.CONTRACT_TX_ID,
    cacheUrl: config.CONTRACT_CACHE_URL,
    lastEvaluationTimestamp: getLastEvaluatedTimestamp(),
  });
});

app.get('/ar-io/resolver/records/:name', async (req, res) => {
  try {
    log.debug('Checking cache for record', { name: req.params.name });
    const resolvedRecordData = await cache.get(req.params.name);
    if (!resolvedRecordData) {
      res.status(404).json({
        error: 'Record not found',
      });
      return;
    }
    const recordData = JSON.parse(resolvedRecordData.toString());
    log.debug('Successfully fetched record from cache', {
      name: req.params.name,
      txId: recordData.txId,
      ttlSeconds: recordData.ttlSeconds,
    });
    res
      .status(200)
      .set({
        'Cache-Control': `public, max-age=${recordData.ttlSeconds}`,
        'Content-Type': 'application/json',
        'X-ArNS-Resolved-Id': recordData.txId,
        'X-ArNS-Ttl-Seconds': new Date().toISOString(),
      })
      .json({
        ...recordData,
        name: req.params.name,
      });
  } catch (err: any) {
    log.error('Failed to get record', {
      name: req.params.name,
      message: err?.message,
      stack: err?.stack,
    });
    res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});
