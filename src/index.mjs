import 'isomorphic-fetch';
import readline from 'readline';
import express from 'express';
import { Session, STAT } from './api/session.mjs';
import { toHere } from './api/here.mjs';
import { log } from './utils/logging.mjs';

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

let sessionCnt = 1; // counting session id
const sessions = []; // session pool

app.use('/here', express.static('here', {
  index: false
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

/*
 * body: prompt
 * => id (plain text)
 */
app.post('/create', async (req, res) => {
  const type = req.body.type;
  if (!type) return res.status(400).send('invalid');
  let s;
  // imagine => new Session(prompt)
  if (type === 'imagine') {
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).send('invalid');
    s = new Session({
      id: sessionCnt++,
      type: 'imagine',
      prompt: prompt
    });
  }
  // upscale => Session.upscale()
  else if (type === 'upscale') {
    const id = req.body.id;
    const num = parseInt(req.body.num);
    if (!id || !num || !sessions[id]) return res.status(400).send('invalid');
    s = sessions[id].upscale(num);
  }
  // variation => Session.variation()
  else if (type === 'variation') {
    const id = req.body.id;
    const num = parseInt(req.body.num);
    if (!id || !num || !sessions[id]) return res.status(400).send('invalid');
    s = sessions[id].variation(num);
  }
  // unknown
  else return res.status(400).send('invalid');
  
  // add to pool
  sessions[s.id] = s;
  const r = await s.send();
  if (r !== STAT.ok) return res.status(r).send('error');
  // don't await, just leave it to collect and hereify
  s.collect().then(async (url) => {
    s.hereUrl = await toHere(url);
  });
  return res.status(201).send(s.id.toString());
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
  if (!s.hereUrl) return res.status(504).send('not hereified');
  return res.status(200).send(
    `/${s.hereUrl}`
  );
});

console.log("We're okay to go! \n----------\n");
/*
let s, r;
rl.on('line', async (line) => {
  const cmd = line.trim().split(' ');
  switch (cmd[0]) {
    case 'new':
      s = new Session({
        prompt: await input('?> ')
      });
      break;
    case 'send':
      r = await s.send();
      console.log(r);
      break;
    case 'collect':
      r = await s.collect();
      console.log(await toHere(r));
      break;
    case 'v':
      s = s.variation(parseInt(cmd[1]));
      await s.send();
      r = await s.collect();
      console.log(r);
      break;
    case 'u':
      s = s.upscale(parseInt(cmd[1]));
      await s.send();
      r = await s.collect();
      console.log(r);
      break;
    default:
      console.log('Unknown Command');
      break;
  }
});*/

app.listen(32767, () => {
  console.log('app listening on port 32767');
});