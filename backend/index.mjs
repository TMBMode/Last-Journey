import 'isomorphic-fetch';
import readline from 'readline';
import express from 'express';
import { Session, STAT } from './api/session.mjs';
import { tribool, generateUid, dateToString } from './utils/functions.mjs';
import { log, color } from './utils/logging.mjs';
import db from './db/index.mjs';

const app = express();
app.use(express.json());

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
}),
input = (q) =>
  new Promise((resolve) => {
    rl.question(q, (a) => {
      resolve(a);
    });
  }
);
const ask = async (q, p = '', d = null) => {
  let a = undefined;
  while (a === undefined) {
    a = (await input(
      `${color.bright}${color.cyan}${q}${color.reset}${(p||d)?' ':''}` +
      `${color.cyan}${p}${d?`(${d})`:''}: ${color.reset}`
    )) || d;
  } return a;
};

const sessions = []; // session pool
const ips = []; // ip record

app.use((req, res, next) => {
  const ip = req.headers['x-real-ip'] || req.ip || 'N/A';
  ips[ip] = ips[ip] ? ips[ip] + 1 : 1;
  next();
});

app.use('/here', express.static('here', {
  index: false,
  maxAge: '31536000s'
}));

app.use('/img', express.static('frontend/img', {
  index: false,
  maxAge: '1d'
}));

app.use('/', express.static('frontend', {
  index: 'lastjourney.html'
}));

app.use((req, res, next) => {
  const auth = req.get('auth')
    ?.match(/lastjourney\/[0-9a-zA-Z\-\+\_%]+/)?.[0]
    ?.replace(/^lastjourney\//, '');
  req.auth = decodeURI(auth);
  next();
});

app.get('/checkauth', async (req, res) => {
  log.info(`Check key <${req.auth}>`);
  if (!req.auth) return res.status(400).send('what');
  const dbRes = await db.checkKey(req.auth);
  if (!dbRes) return res.status(404).send('not exists');
  return res.status(200).send(JSON.stringify({
    remaining: dbRes.remaining,
    expires: dateToString(dbRes.expires)
  }));
});

// id => database or memory has session ? place in memory, true : false
const ensureSession = async (id) => {
  if (sessions[id]) return true;
  const data = await db.getSession(id);
  if (!data) return false;
  const s = new Session(data);
  s.finished = true;
  s.messageId = data.messageId;
  s.customId = data.customId;
  sessions[id] = s;
  return true;
}

/*
 * body: prompt
 * => id (plain text)
 */
app.post('/create', async (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip || 'N/A';
  log.debug(`Create request with key <${req.auth}>`);
  // is request valid?
  const type = req.body.type;
  if (!type) return res.status(400).send('invalid');
  if (!req.auth) return res.status(402).send('no auth');
  // is key available?
  const dbRes = await db.useKey(req.auth);
  if (dbRes !== db.STAT.ok) return res.status(403).send('bad key');
  // accept request, create session based on type
  log.info(`Accept create request with key <${req.auth}> from ip <${ip}>`);
  let session;
  // imagine => new Session(prompt)
  if (type === 'imagine') {
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).send('invalid');
    session = new Session({
      type: 'imagine',
      prompt: prompt
    });
  }
  // upscale => Session.upscale()
  else if (type === 'upscale') {
    const id = req.body.id;
    const num = parseInt(req.body.num);
    if (!id || !num || !(await ensureSession(id))) return res.status(400).send('invalid');
    session = sessions[id].upscale(num);
  }
  // variation => Session.variation()
  else if (type === 'variation') {
    const id = req.body.id;
    const num = parseInt(req.body.num);
    if (!id || !num || !(await ensureSession(id))) return res.status(400).send('invalid');
    session = sessions[id].variation(num);
  }
  // unknown
  else return res.status(400).send('invalid');
  // add to pool
  sessions[session.id] = session;
  const r = await session.send();
  if (r !== STAT.ok) return res.status(r).send('error');
  // don't await, just leave it to collect and hereify
  session.collect();
  return res.status(201).send(session.id.toString());
});

/*
 * body: session id
 * => 504 error / 200 url
 */
app.post('/result', async (req, res) => {
  const id = req.body.id;
  if (!id) return res.status(400).send('invalid');
  const s = sessions[id];
  if (!s) return res.status(404).send('not found');
  if (!s.finished) return res.status(504).send('not finished');
  // if finished, then
  sessions[id] = null;
  if (!s.hereUrl) {
    await db.refundKey(req.auth);
    return res.status(500).send('server error');
  }
  return res.status(200).send(s.hereUrl);
});

// listen it
const PORT = process.env.PORT ?? 32767;
app.listen(PORT, () => {
  log.notice(`
          __
         / /
        / /
       / /
      / /        _
     / /        \\_/    Lastjourney v1.0.2
    / /        __
   / /        / /
  / /________/ /    Listening
 /__________  /    Port ${PORT}
           / /
          / /
         / /
      __/ /
      \\__/
  `);
});

const inputAddKey = async () => {
  const isFixedKey = await ask('Specify key?', '[Y/N]', 'N');
  let key;
  if (tribool(isFixedKey) === 1) {
    key = await ask('Key');
  } else key = generateUid(8);
  const name = await ask('Name', '', 'N/A');
  let count = NaN;
  while (isNaN(count)) {
    count = parseInt(await ask('Grant count', '[int]'));
  }
  let days = NaN;
  while (isNaN(days)) {
    days = parseFloat(await ask('Grant time', '[days]'));
  }
  const res = await db.addKey({
    id: key,
    name,
    count,
    expires: parseInt(Date.now() + (days * 86400000))
  });
  if (res === db.STAT.ok) {
    log.notice(`Add key ${key}`);
  }
  return;
}

// command interface
rl.on('line', async (line) => {
  if (line.match(/^\//)) {
    try {
      return console.log(eval(line.replace(/^\//, '')));
    } catch (e) {
      return console.error(e);
    }
  }
  const cmd = line.trim().split(' ');
  switch (cmd[0]) {
    case '':
      break;
    case 'stop':
      process.exit();
      break;
    case 'new':
      await inputAddKey();
      break;
    case 'del':
      if (await db.deleteKey(cmd[1])) log.info(`Del key ${cmd[1]}`);
      break;
    case 'lsss':
      console.table(sessions);
      break;
    case 'lsdbss':
      console.table(await db.getAllSessions());
      break;
    case 'lskeys':
      console.table(await db.getAllKeys());
      break;
    case 'lsip':
      console.table(ips);
      break;
    default:
      console.log('Unknown command');
      break;
  }
  return;
});