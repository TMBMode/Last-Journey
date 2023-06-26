import 'isomorphic-fetch';
import readline from 'readline';
import express from 'express';
import { Session, STAT } from './api/session.mjs';
import { log } from './utils/logging.mjs';
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

const sessions = []; // session pool

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
    ?.match(/lastjourney\/[0-9a-zA-Z\-\+\_]+/)?.[0]
    ?.replace(/^lastjourney\//, '');
  if (auth !== 'ojbk') return res.status(401).send('unauthorized');
  next();
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
  const type = req.body.type;
  if (!type) return res.status(400).send('invalid');
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
  return res.status(200).send(s.hereUrl);
});

// listen it
const PORT = process.env.PORT ?? 32767;
app.listen(PORT, () => {
  log.notice(`App listening on port ${PORT}`);
});

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
    case 'lsdb':
      console.table(await db.getAllSessions());
      break;
    default:
      console.log('Unknown command');
      break;
  }
  return;
});