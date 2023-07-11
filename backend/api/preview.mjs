import sharp from "sharp";
import fs from 'fs';
import { log } from "../utils/logging.mjs";

export const toPreview = async (imagePath) => {
  log.debug(`toPreview request ${imagePath}`);
  if (!fs.existsSync(imagePath)) return null;
  const ext = imagePath.match(/\.((png)|(jpg)|(webp))$/)?.[0];
  if (!ext) return null;
  const base = imagePath.replace(ext, '');
  const newPath = `${base}.preview.jpg`;
  await sharp(imagePath)
    .resize({width: 512})
    .jpeg({quality: 80})
    .toFile(newPath);
  log.notice(`Preview ${imagePath} > ${newPath}`);
  return newPath;
}