/**
 * AR.IO Observer
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
import dotenv from 'dotenv';

import * as env from './lib/env.js';

dotenv.config();

export const EVALUATION_INTERVAL_MS = +env.varOrDefault(
  'EVALUATION_INTERVAL_MS',
  `${60 * 60 * 15}`, // 15 mins by default
);

export const RUN_RESOLVER = env.varOrDefault('RUN_RESOLVER', 'true') === 'true';
export const ENABLE_OPENAPI_VALIDATION =
  env.varOrDefault('ENABLE_OPENAPI_VALIDATION', 'true') === 'true';

export const CONTRACT_CACHE_URL = env.varOrDefault(
  'CONTRACT_CACHE_URL',
  'https://api.arns.app',
);
export const CONTRACT_TX_ID = env.varOrDefault(
  'CONTRACT_TX_ID',
  'bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U',
);
export const PORT = +env.varOrDefault('PORT', '6000');
