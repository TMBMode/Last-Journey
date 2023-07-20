'use strict';
console.log(`
          __
         / /
        / /
       / /
      / /        _
     / /        \\_/
    / /        __
   / /        / /
  / /________/ /
 /__________  /    Github: TMBMode/Lastjourney
           / /
          / /
         / /
      __/ /
      \\__/
`);

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
const __name__ = '__main__';
let authKey;

const sleep = (ms) => (
  new Promise(resolve => setTimeout(resolve, ms))
);
const ls = {
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  get: (key) => JSON.parse(localStorage.getItem(key)),
  remove: localStorage.removeItem.bind(localStorage),
  clear: localStorage.clear.bind(localStorage)
};

let stat = 'free';
let currentSession = null;
let sessions = [];

const dom = {
  flipper: $('#flipper'),
  resultFace: $('#result'),
  resultLink: $('#result > a'),
  resultImage: $('#result .image'),
  buttons: $('#buttons'),
  uvButtons: $$('#buttons > .button.u, #buttons > .button.v'),
  rerollButton: $('#buttons > .button.r'),
  progress: {
    bar: $('#result > .progress'),
    hint: $('#result > .hint'),
    game: $('#result > iframe')
  },
  crafter: {
    prompt: $('#crafter .prompt'),
    attributes: $$('#crafter .attr'),
    mode: $('#crafter .mode'),
    translate: $('#crafter .translate')
  },
  sendButton: $('#crafter #finish'),
  gallery: {
    container: $('#gallery'),
    toggler: $('#gallery > .toggler'),
    backdrop: $('#backdrop'),
    list: $('#gallery > .list')
  },
  auth: {
    count: $('#auth > .remaining > .count'),
    expireDate: $('#auth > .expireDate')
  }
};

// x = 0/1 => result face / crafter face
const flip = (x) => {
  if (x) {
    dom.flipper.classList.remove('move');
    dom.flipper.classList.add('flip');
  } else {
    dom.flipper.classList.remove('flip');
  }
}
// x = 0/1/2/3 => not show / only exit / no reroll / show all
const showButtons = (x) => {
  if (x) {
    dom.flipper.classList.remove('flip');
    dom.flipper.classList.add('move');
    dom.buttons.classList.add('show');
    for (let button of dom.uvButtons) {
      if (x < 2) button.classList.add('disabled');
      else button.classList.remove('disabled');
    }
    if (x < 3) dom.rerollButton.classList.add('disabled');
    else dom.rerollButton.classList.remove('disabled');
  } else {
    dom.flipper.classList.remove('move');
    dom.buttons.classList.remove('show');
  }
}
// url = string / null, preview = string / null => show image with url (and preview) / not show
const showImage = (url, preview) => {
  if (!url) {
    dom.resultLink.style.pointerEvents = 'none';
    dom.resultImage.style.opacity = 0;
  } else {
    dom.resultImage.src = '';
    setTimeout(() => {
      dom.resultLink.style.pointerEvents = 'auto';
      dom.resultLink.href = url;
      dom.resultImage.src = preview || url;
      dom.resultImage.style.opacity = 1;
    }, 0);
  }
}
// null => sidebar toggle
const toggleGallery = () => {
  dom.gallery.backdrop.classList.toggle('show');
  dom.gallery.container.classList.toggle('show');
}
// everyone loves fake progress bars
const progress = {
  value: 0,
  loop: null,
  start: () => {
    dom.resultFace.classList.add('loading');
    dom.progress.game.contentWindow.postMessage('start', '*');
    this.value = 0;
    this.loop = setInterval(() => {
      this.value = Math.min(this.value + Math.random(), 99.99);
      dom.progress.bar.style.width = `${parseInt(this.value)}%`;
      dom.progress.hint.textContent = `${parseInt(this.value)}%`;
    }, 400);
  },
  stop: () => new Promise((resolve) => {
    dom.resultFace.classList.remove('loading');
    dom.progress.game.contentWindow.postMessage('pause', '*');
    clearInterval(this.loop);
    dom.progress.bar.style.width = `100%`;
    dom.progress.hint.textContent = '100%';
    setTimeout(() => {
      dom.progress.bar.style.width = `0%`;
      dom.progress.hint.textContent = '';
      resolve();
    }, 500);
  })
};
// read from local storage and update
const updateCollections = () => {
  sessions = [];
  dom.gallery.list.innerHTML = '';
  const collections = ls.get('collections');
  for (let item of (collections ?? [])) {
    sessions.push({
      imageUrl: item.imageUrl,
      previewUrl: item.previewUrl,
      session: new Session({
        type: 'imagine',
        id: item.id,
        basePrompt: item.basePrompt,
        prompt: item.prompt
      })
    });
    dom.gallery.list.innerHTML += `
      <div class="item" onclick="gotoSession(${sessions.length-1})">
        <span class="main"> ${item.basePrompt} </span>
        <span class="sub"> #${item.id} </span>
      </div>
    `;
  }
};
// retrieve session from id
const gotoSession = (i) => {
  // don't run it, just goto image
  flip(false);
  const s = sessions[i];
  // session before the preview update
  if (s.previewUrl === 'undefined') {
    s.previewUrl = s.imageUrl;
  }
  showImage(s.imageUrl, s.previewUrl);
  // match basePrompt for upscales
  if (s.session.basePrompt.match(/ > U[1-4]$/)) {
    return showButtons(1);
  }
  // otherwise we need to enable u/v
  currentSession = s.session;
  // no reroll for variations
  if (s.session.basePrompt.match(/ > V[1-4]$/)) {
    return showButtons(2);
  }
  return showButtons(3);
};

// classing again...
class Session {
  constructor(params) {
    this.type = params.type ?? 'imagine';
    this.basePrompt = params.basePrompt;
    this.prompt = params.prompt;
    this.from = params.from ?? {}
    this.id = params.id ?? null;
    this.imageUrl = params.imageUrl ?? null;
    this.previewUrl = params.previewUrl ?? null;
  }
  // params => this.id
  async send() {
    const res = await fetch('/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth': `lastjourney/${authKey ?? ''}`
      },
      body: JSON.stringify({
        type: this.type,
        prompt: this.prompt,
        id: this.from.id,
        num: this.from.num
      })
    });
    if (res.status === 402) {
      return alert(`没有密钥，请输入后重试`);
    }
    if (res.status === 403) {
      return alert(`密钥无效或已达使用限制`);
    }
    if (!res.ok) {
      return alert(`发生未知错误 ${res.status}`);
    }
    return this.id = await res.text();
  }
  // this.id => this.imageUrl
  async collect() {
    await sleep(10000);
    const res = await fetch('/result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth': `lastjourney/${authKey ?? ''}`
      },
      body: JSON.stringify({
        id: this.id
      })
    });
    if (res.status === 504) {
      return this.collect();
    } 
    if (res.status === 500) {
      return alert('绘图失败，请重试或尝试更改提示词');
    }
    if (!res.ok) {
      return alert(`发生未知错误 ${res.status}`);
    }
    const url = JSON.parse(await res.text());
    this.imageUrl = url.full;
    this.previewUrl = url.preview;
    return this.imageUrl && this.previewUrl;
  }
  // add to history collections
  async toCollections() {
    const collections = ls.get('collections') ?? [];
    // skip if something with the same id exists
    // empty [] == false, but [] ? 1 : 0 == 1... wtf?
    if (collections.filter((item) => (item.id === this.id)).length) return;
    // append
    ls.set('collections', [...collections, {
      id: this.id,
      imageUrl: this.imageUrl,
      previewUrl: this.previewUrl,
      basePrompt: this.basePrompt,
      prompt: this.prompt
    }]);
  }
  // run it
  async run() {
    if (stat !== 'free') return alert('有正在进行的任务');
    stat = 'working';
    flip(false);
    showButtons(0);
    showImage(false);
    progress.start();
    let res = await this.send();
    // send failed
    if (!res) {
      await progress.stop();
      showButtons(1);
      return stat = 'free';
    }
    res = await this.collect();
    await progress.stop();
    // collect failed
    if (!res) {
      showButtons(1);
      return stat = 'free';
    }
    showImage(this.imageUrl, this.previewUrl);
    this.toCollections();
    updateCollections();
    if (this.type === 'upscale') showButtons(1);
    else if (this.type === 'variation') showButtons(2);
    else showButtons(3);
    updateAuth(authKey);
    return stat = 'free';
  }
}

// button bound imagine
const imagine = async () => {
  const basePrompt = dom.crafter.prompt.value.replace('\n','').trim();
  if (!basePrompt) {
    return alert('内容不能为空');
  }
  const promptParams = basePrompt.match(/--\w+/g)
    ?.filter(item => item !== '--no');
  if (promptParams?.length) {
    return alert(`提示词不能包含参数：${promptParams}`);
  }
  let prompt = basePrompt;
  for (let attr of dom.crafter.attributes) {
    prompt += `${attr.value && ' '}${attr.value}`;
  }
  prompt = prompt.trim();
  currentSession = new Session({
    type: 'imagine',
    basePrompt,
    prompt
  });
  await currentSession.run();
};

// button bound upscale
const upscale = async (x) => {
  currentSession = new Session({
    type: 'upscale',
    basePrompt: `${currentSession.basePrompt} > U${x}`,
    from: {
      id: currentSession.id,
      num: x
    }
  });
  await currentSession.run();
}

// button bound variation
const variation = async (x) => {
  currentSession = new Session({
    type: 'variation',
    basePrompt: `${currentSession.basePrompt} > V${x}`,
    from: {
      id: currentSession.id,
      num: x
    }
  });
  await currentSession.run();
}

// button bound reroll
const reroll = async () => {
  currentSession = new Session({
    type: 'imagine',
    basePrompt: `${currentSession.basePrompt} > R`,
    prompt: currentSession.prompt
  });
  await currentSession.run();
}

// button bound exit
const exitSession = () => {
  if (stat !== 'free') return alert('有绘图任务未结束');
  showButtons(0);
  showImage(false);
  flip(true);
}

// button bound change and refresh auth key
const updateAuth = async (key) => {
  authKey = key ?? (encodeURI(prompt('🔑') || '') || authKey);
  let data = {
    remaining: 0,
    expires: '1970-01-01'
  };
  let res = await fetch('/checkauth', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'auth': `lastjourney/${authKey}`
    }
  });
  if (res.ok) {
    data = JSON.parse(await res.text());
  }
  dom.auth.count.textContent = data.remaining;
  dom.auth.expireDate.textContent = `${data.expires}到期`;
  return ls.set('authKey', authKey);
}

if (__name__ == '__main__') {
  setTimeout(() => {
    updateCollections();
    authKey = ls.get('authKey');
    updateAuth(authKey);
  }, 0);
}