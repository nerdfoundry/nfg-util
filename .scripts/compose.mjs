#!/usr/local/bin/npx zx

/**
 * Let the user know this is running without an Environment Config/Setup
 *
 * Presents the user with possible options to proceed and keeps the container alive.
 */

import { $, chalk, echo } from 'zx';

$.verbose = false;

const { yellow, green, grey, bold } = chalk;

const hostnameRaw = await $`hostname`;
const hostname = green(hostnameRaw).replace('\n', '');
const exampleCmd = yellow`npm run dev`;

await echo`${yellow`This is running in docker-compose without an Environment Config...`}`;

await echo`
You can run commands interactively in another terminal by attaching:
    ${grey`docker exec -it`} ${hostname} ${exampleCmd}
`;

await echo`Or you can press ${bold`<CTRL+C>`}, and try one of the following:
    * Use one of the included runtime scripts:
      ${grey`i.e.,`} ${bold`./.scripts/dev.sh`}

    * Overlay EnvConfigs as necessary:
      ${grey`i.e.,`} ${bold`docker-compose -f ./docker-compose.yml -f ./docker-compose.`}${grey`<Env>`}${bold`.yml up`}
`;

await echo(bold(green`Peristing Container...`));
await $`tail -f /dev/null`;
