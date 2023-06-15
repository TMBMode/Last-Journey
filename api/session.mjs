import { conf } from "../config.mjs";
import { baseUrl, proxyAgent, headers, payload } from "./data.mjs";
import { log } from '../utils/logging.mjs';
import { sleep } from "../utils/functions.mjs";

// count session numbers
let sessionCnt = 1;

export class Session {
  constructor(prompt) {
    this.id = sessionCnt++;
    this.startTime = Date.now();
    this.prompt = prompt;
    this.finished = false;
    this.imageUrl = '';
    this.headers = headers();
    this.payload = payload(prompt);
    log.notice(`Create #${this.id}`);
  }
  // send message to discord
  async send() {
    log.info(`Send #${this.id}`);
    const res = await fetch(baseUrl.send, {
      mode: 'cors',
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(this.payload),
      agent: proxyAgent
    });
    // ok stat codes 200-299
    if (parseInt(res.status/100) === 2) {
      log.notice(`#${this.id} Send OK ${res.status}`);
      return true;
    }
    // non-ok
    log.error(`#${this.id} Send Error ${res.status}`);
    console.log(res.headers);
    return false;
  }
  // check till the image request finishes
  async collect() {
    await sleep(conf.get_interval);
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
      // if has already started painting
      if (msg.content.match(/ \(((fast)|(relaxed))\)$/)) {
        // pass if there is a progress (not finished)
        if (msg.content.match(/\> \(\d+%\) \(/)) continue;
        // pass if there is no image
        if (!msg.attachments) continue;
        // get the image's URL
        this.imageUrl = msg.attachments[0].url;
        // flag as done
        this.finished = true;
        log.notice(`#${this.id} finished ` +
          `in ${parseInt((Date.now() - this.startTime) / 1000)} seconds ` +
          `(URL: ${this.imageUrl})`);
      }
    }
    // recursive call
    if (!this.finished) {
      return this.collect();
    } else {
      // always remember to give async functions a return statement
      return this.imageUrl;
    }
  }
}