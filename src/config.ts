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
import dotenv from 'dotenv';

import * as env from './lib/env.js';

dotenv.config();

export const EVALUATION_INTERVAL_MS = +env.varOrDefault(
  'EVALUATION_INTERVAL_MS',
  `${1000 * 60 * 15}`, // 15 mins by default
);
export const RUN_RESOLVER = env.varOrDefault('RUN_RESOLVER', 'true') === 'true';
export const ENABLE_OPENAPI_VALIDATION =
  env.varOrDefault('ENABLE_OPENAPI_VALIDATION', 'true') === 'true';
export const IO_PROCESS_ID = env.varOrDefault(
  'IO_PROCESS_ID',
  'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
);
export const ARNS_CACHE_PATH = env.varOrDefault(
  'ARNS_CACHE_PATH',
  './data/arns',
);
export const PORT = +env.varOrDefault('PORT', '6000');
