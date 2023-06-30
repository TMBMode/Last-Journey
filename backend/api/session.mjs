import { conf } from "../config.mjs";
import { baseUrl, proxyAgent, headers, imagine, uv } from "./data.mjs";
import { log } from '../utils/logging.mjs';
import { sleep, generateUid } from "../utils/functions.mjs";
import { toHere } from "./here.mjs";
import db from "../db/index.mjs";

// status codes
export const STAT = {
  ok: 201,
  invalid: 400,
  conflict: 409,
  error: 500,
};

export class Session {
  constructor(params) {
    this.id = params.id ?? generateUid(6); // identifier
    this.startTime = Date.now(); // session create timestamp
    this.type = params.type ?? 'imagine'; // one of 'imagine', 'upscale', or 'variation'
    this.from = params.from ?? {}; // for upscale/variation, { messageId, customId }
    this.prompt = params.prompt; // original prompt
    this.finished = false; // flag for session done
    this.imageUrl = ''; // retrieved url when session finishes
    this.hereUrl = ''; // hereified image url
    this.messageId = ''; // id of the response message
    this.customId = ''; // custom id for upscale/variation (if applicable)
    log.notice(`Create #${this.id} "${this.prompt}"`);
  }
  /* 
   * async Session.send()
   * this => send status
   * send message to discord
   */
  async send() {
    log.debug(`Send #${this.id}`);
    // if we have something with the same id in the database
    // then we can just skip sending
    const dbRes = await db.getSession(this.id);
    if (dbRes) {
      log.info(`#${this.id} duplicate, skip send`);
      // pack data
      this.hereUrl = dbRes.imageUrl;
      this.messageId = dbRes.messageId;
      this.customId = dbRes.customId;
      this.finished = true;
      // overwrite collect
      this.collect = async () => {
        log.notice(`#${this.id} > ${dbRes.imageUrl}`);
        return dbRes.imageUrl;
      };
      return STAT.ok;
    }
    // normal send
    const res = await fetch(baseUrl.send, {
      mode: 'cors',
      method: 'POST',
      headers: headers,
      body: (this.type === 'imagine' ?
        imagine(this.prompt) :
        uv(this.from.messageId, this.from.customId)),
      agent: proxyAgent
    });
    // ok
    if (res.ok) {
      log.info(`#${this.id} send ok ${res.status}`);
      return STAT.ok;
    }
    // non-ok
    log.error(`#${this.id} send error ${res.status}`);
    return STAT.error;
  }
  /*
   * async Session.collect()
   * this => result image url (hereified)
   * also saves data into this
   * fetch messages till desired response found, then save
   */
  async collect() {
    log.debug('Collect results');
    // check for timeout
    if (Date.now() - this.startTime > (conf.session_timeout * 1000)) {
      log.error(`#${this.id} timeout`);
      this.finished = true;
      return null;
    }
    // we need a lullaby here
    await sleep(conf.get_interval * 1000);
    // alright let's go
    const res = await fetch(baseUrl.retrieve, {
      mode: 'cors',
      method: 'GET',
      headers: headers,
      agent: proxyAgent
    });
    // handle retrieved message list
    const data = JSON.parse(await res.text());
    for (let msg of data) {
      // pass if message isn't by bot
      if (msg.author.id !== conf.application_id) continue;
      // pass if it's not the prompt of this session
      if (!msg.content.match(new RegExp(`\\*\\*${this.prompt}\\*\\*`))) continue;
      // pass if not yet started painting
      if (this.type !== 'upscale' && !msg.content.match(/ \(((fast)|(relaxed))\)$/)) continue;
      // pass if there is a progress (not finished)
      if (msg.content.match(/\> \(\d+%\) \(/)) continue;
      // pass if in variation mode but not getting variations
      if (this.type === 'variation' && !msg.content.match(/- Variations (\(.*\) )?by/)) continue;
      // pass if in upscale mode but not getting upscales
      if (this.type === 'upscale' && !msg.content.match(/- Image #\d/)) continue;
      // pass if there is no image
      if (!msg.attachments?.[0]) continue;
      // pass if we already operated on this message
      if (await db.existsMessageId(msg.id)) continue;
      // now we can assume this is the message we want
      // get the results
      this.imageUrl = msg.attachments[0].url;
      this.messageId = msg.id;
      // record custom id
      this.customId = msg.components?.[0]?.components?.[0]?.custom_id?.split('::').pop();
      // hereify url
      this.hereUrl = '/' + await toHere(this.imageUrl, this.id);
      // save to database
      await db.saveSession(this);
      // do some logging
      log.debug(`#${this.id} custom id ${this.customId}`);
      log.notice(`#${this.id} finished = ${parseInt((Date.now() - this.startTime) / 1000)}s`);
      log.notice(`#${this.id} > ${this.hereUrl}`);
      // done!
      this.finished = true;
      break;
    }
    // recursive call
    if (!this.finished) {
      return this.collect();
    } else {
      // always remember to give async functions a return statement
      return this.imageUrl;
    }
  }
  /*
   * sync Session.upscale()
   * upscale id (1-4) => new Session
   * create a session for upscale
   */
  upscale(x) {
    if (!this.finished) return STAT.conflict;
    if (this.type === 'upscale') return STAT.invalid;
    if (!this.customId) return STAT.invalid;
    // create an upscale session
    return new Session({
      id: `${this.id}-U${x}`,
      type: 'upscale',
      prompt: this.prompt,
      from: {
        messageId: this.messageId,
        customId: `MJ::JOB::upsample::${x}::${this.customId}`
      }
    });
  }
  /*
   * sync Session.variation()
   * variation id (1-4) => new Session
   * create a session for variation
   */
  variation(x) {
    if (!this.finished) return STAT.conflict;
    if (this.type === 'upscale') return STAT.invalid;
    if (!this.customId) return STAT.invalid;
    // create a variation session
    return new Session({
      id: `${this.id}-V${x}`,
      type: 'variation',
      prompt: this.prompt,
      from: {
        messageId: this.messageId,
        customId: `MJ::JOB::variation::${x}::${this.customId}`
      }
    });
  }
}