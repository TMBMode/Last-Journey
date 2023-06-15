import 'isomorphic-fetch';
import { Session } from './api/session.mjs';

(async () => {
  let s = new Session('misaka mikoto, fighting --niji 5');
  await s.send();
  let r = await s.collect();
  console.log(r);
})();