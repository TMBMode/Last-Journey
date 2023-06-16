import 'isomorphic-fetch';
import readline from 'readline';
import { Session } from './api/session.mjs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
});
const input = (q) =>
  new Promise((resolve, reject) => {
    rl.question(q, (a) => {
      resolve(a);
    });
  }
);

console.log("We're okay to go! \n----------\n");

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
      console.log(r);
      break;
    case 'v':
      s = s.variation(parseInt(cmd[1]));
      await s.send();
      r = await s.collect();
      console.log(r);
      break;
    case 'u':
      r = await s.upscale(parseInt(cmd[1]));
      console.log(r);
      break;
    default:
      console.log('Unknown Command');
      break;
  }
});
/*
(async () => {
  let s = new Session('misaka mikoto, fighting --niji 5');
  await s.send();
  let r = await s.collect();
  console.log(r);
})();
*/