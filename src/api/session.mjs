import { conf } from "../config.mjs";
import { baseUrl, proxyAgent, headers, imagine, uv } from "./data.mjs";
import { log } from '../utils/logging.mjs';
import { sleep } from "../utils/functions.mjs";

// status codes
export const STAT = {
  ok: 201,
  invalid: 400,
  conflict: 409,
  error: 500,
}

// count sessions
let sessionCnt = 1;

export class Session {
  constructor(params) {
    this.id = sessionCnt++; // autoincrement cnt
    this.startTime = Date.now(); // session create timestamp
    this.type = params.type ?? 'imagine'; // one of 'imagine', 'upscale', or 'variation'
    this.from = params.from ?? {}; // for upscale/variation, { messageId, customId }
    this.prompt = params.prompt; // original prompt
    this.finished = false; // flag for session done
    this.imageUrl = ''; // retrieved url when session finishes
    this.responseId = ''; // id of the response message
    this.options = { u: [''], v: ['']}; // upscale/variation custom id's (if applicable)
    this.headers = headers(); // request authorization headers
    log.notice(`Create #${this.id} "${this.prompt}"`);
  }
  /* 
   * async Session.send()
   * this => send status
   * send message to discord
   */
  async send() {
    log.debug(`Send #${this.id}`);
    const res = await fetch(baseUrl.send, {
      mode: 'cors',
      method: 'POST',
      headers: this.headers,
      body: (this.type === 'imagine' ?
        imagine(this.prompt) :
        uv(this.from.messageId, this.from.customId)),
      agent: proxyAgent
    });
    // ok
    if (res.ok) {
      log.notice(`#${this.id} Send OK ${res.status}`);
      return STAT.ok;
    }
    // non-ok
    log.error(`#${this.id} Send Error ${res.status}`);
    return STAT.error;
  }
  /*
   * async Session.collect()
   * this => result image url
   * fetch messages till desired response found
   */
  async collect() {
    // check for timeout
    if (Date.now() - this.startTime > conf.get_timeout) return null;
    // we need a lullaby here
    await sleep(conf.get_interval);
    // alright let's go
    const res = await fetch(baseUrl.retrieve, {
      mode: 'cors',
      method: 'GET',
      headers: this.headers,
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
      if (this.type === 'variation' && !msg.content.match(/- Variations by/)) continue;
      // pass if in upscale mode but not getting upscales
      if (this.type === 'upscale' && !msg.content.match(/- Image #\d/)) continue;
      // pass if there is no image
      if (!msg.attachments?.[0]) continue;
      // get the results
      this.imageUrl = msg.attachments[0].url;
      this.responseId = msg.id;
      // record u/v custom id's
      for (let line of msg.components) {
        for (let item of line.components) {
          if (item.label?.match(/^U\d$/)) {
            this.options.u.push(item.custom_id);
          } else if (item.label?.match(/^V\d$/)) {
            this.options.v.push(item.custom_id);
          }
        }
      }
      // flag as done
      this.finished = true;
      log.notice(`#${this.id} finished = ${parseInt((Date.now() - this.startTime) / 1000)}s`);
      log.debug(`#${this.id} > ${this.imageUrl}`);
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
   * async Session.upscale()
   * upscale id (1-4) => result image url
   * send an upscale request and get the result
   */
  async upscale(x) {
    if (!this.finished) return STAT.conflict;
    if (this.type === 'upscale') return STAT.invalid;
    if (!this.options.u[x]) return STAT.invalid;
    // create an upscale session
    const session = new Session({
      type: 'upscale',
      prompt: this.prompt,
      from: {
        messageId: this.responseId,
        customId: this.options.u[x]
      }
    });
    await session.send();
    return await session.collect();
  }
  /*
   * sync Session.variation()
   * variation id (1-4) => new Session
   * create a session for variation
   */
  variation(x) {
    if (!this.finished) return STAT.conflict;
    if (this.type === 'upscale') return STAT.invalid;
    if (!this.options.v[x]) return STAT.invalid;
    // create a variation session
    return new Session({
      type: 'variation',
      prompt: this.prompt,
      from: {
        messageId: this.responseId,
        customId: this.options.v[x]
      }
    });
  }
}