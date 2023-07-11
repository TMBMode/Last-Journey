import fs from 'fs';
import { proxyAgent } from './data.mjs';
import { generateUid } from '../utils/functions.mjs';
import { log } from '../utils/logging.mjs';
import { pipeline } from 'stream/promises';

export const toHere = async (url, id) => {
  log.debug(`Download start ${url}`);
  const ext = url.match(/\.((png)|(jpg)|(webp))$/)?.[0];
  if (!ext) return null;
  const res = await fetch(url, {
    method: "GET",
    agent: proxyAgent
  });
  if (!res.ok) return null;
  const dest = `here/${id ?? generateUid(6)}${ext}`;
  const file = fs.createWriteStream(dest);
  await pipeline(res.body, file);
  file.end();
  log.debug(`Download file ${url} => ${dest}`);
  return dest;
}