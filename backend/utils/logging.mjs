import { getTime } from "./functions.mjs";

const isDebug = eval(process.env.DEBUG) ?? true;
info(`Debug: ${isDebug}`);

const reset = '\x1b[0m',
      bright = '\x1b[1m',
      yellow = '\x1b[33m',
      red = '\x1b[31m',
      green = '\x1b[32m',
      cyan = '\x1b[36m';

function info(text) {
  console.log(`[${getTime()}] INFO | ${text}`);
}

function warn(text) {
  console.log(`${bright}${yellow}[${getTime()}] WARNING | ${text}${reset}`);
}

function error(text) {
  console.log(`${bright}${red}[${getTime()}] ERROR | ${text}${reset}`);
}

function notice(text) {
  console.log(`${bright}${green}[${getTime()}] NOTICE | ${text}${reset}`);
}

function debug(text) {
  isDebug &&
  console.log(`${bright}${cyan}[${getTime()}] DEBUG | ${text}${reset}`);
}

export const log = {
  info, warn, error, notice, debug
};

export const color = {
  reset, bright, yellow, red, green, cyan
};