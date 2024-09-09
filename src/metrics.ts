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
import * as promClient from 'prom-client';

export const metrics = new promClient.Registry();

// ARNS cache metrics
export const arnsCacheHit = new promClient.Counter({
  name: 'arns_cache_hit',
  help: 'Number of times the ARNS cache was hit',
  labelNames: ['cache_type'],
});

export const arnsCacheMiss = new promClient.Counter({
  name: 'arns_cache_miss',
  help: 'Number of times the ARNS cache was missed',
  labelNames: ['cache_type'],
});

// Redis metrics
export const redisConnectionError = new promClient.Gauge({
  name: 'redis_connection_error',
  help: 'Redis connection error',
});

export const redisErrors = new promClient.Counter({
  name: 'redis_errors',
  help: 'Redis errors',
  labelNames: ['error'],
});
