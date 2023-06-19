import fs from 'fs';
import { proxyAgent } from './data.mjs';
import { generateUid } from '../utils/functions.mjs';
import { log } from '../utils/logging.mjs';
import { pipeline } from 'stream/promises';

export const toHere = async (url) => {
  const sfx = url.match(/\.((png)|(jpg)|(webp))$/)?.[0];
  if (!sfx) return null;
  const res = await fetch(url, {
    method: "GET",
    agent: proxyAgent
  });
  if (!res.ok) return null;
  const dest = `here/${generateUid(6)}${sfx}`;
  const file = fs.createWriteStream(dest);
  await pipeline(res.body, file);
  file.end();
  log.debug(`Download file ${url} => ${dest}`);
  return dest;
}