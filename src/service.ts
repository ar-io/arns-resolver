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
import * as config from './config.js';
import log from './log.js';
import { app } from './server.js';
import { evaluateArNSNames } from './system.js';

if (config.RUN_RESOLVER) {
  // set the evaluation to run at the configured interval
  setInterval(evaluateArNSNames, config.EVALUATION_INTERVAL_MS);

  app.listen(config.PORT, () => {
    log.info(`Listening on port ${config.PORT}`);
  });

  evaluateArNSNames();
}
