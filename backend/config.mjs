import fs from 'fs';
import { log } from "./utils/logging.mjs";

export const conf = {};

// set `conf` values from `config.json`
// asserting all values are truthy
const data = JSON.parse(fs.readFileSync('config.json'));
(
  (conf.authorization = data.authorization) &&
  (conf.application_id = data.application_id) &&
  (conf.guild_id = data.guild_id) &&
  (conf.channel_id = data.channel_id) &&
  (conf.session_id = data.session_id) &&
  (conf.data_version = data.data_version) &&
  (conf.data_id = data.data_id) &&
  (conf.get_limit = (data.get_limit || 3)) &&
  (conf.get_interval = (data.get_interval || 5)) &&
  (conf.session_timeout = (data.session_timeout || 120)) &&
  ((conf.user_agent = data.user_agent || null) || 1) &&
  ((conf.proxy = data.proxy || null) || 1)
)
||
(
  log.error('(Fatal) Required configs not complete') ||
  process.exit()
);