'use strict';
console.log(`
;;;;;;;;;;;;;;      ;;;;        ;;  ;;;;;;;;;;;;;;
;;          ;;  ;;;;        ;;;;    ;;          ;;
;;  ;;;;;;  ;;    ;;;;      ;;;;;;  ;;  ;;;;;;  ;;
;;  ;;;;;;  ;;  ;;;;    ;;;;  ;;    ;;  ;;;;;;  ;;
;;  ;;;;;;  ;;        ;;  ;;    ;;  ;;  ;;;;;;  ;;
;;          ;;  ;;  ;;  ;;;;;;;;;;  ;;          ;;
;;;;;;;;;;;;;;  ;;  ;;  ;;  ;;  ;;  ;;;;;;;;;;;;;;
                      ;;    ;;  ;;                
;;;;;;;;;;  ;;;;;;;;;;;;;;  ;;    ;;  ;;  ;;  ;;  
;;  ;;    ;;    ;;;;  ;;  ;;    ;;    ;;      ;;  
    ;;;;  ;;;;;;  ;;    ;;  ;;;;;;;;  ;;;;;;  ;;;;
;;;;            ;;;;;;;;;;    ;;;;;;;;;;;;    ;;;;
  ;;  ;;  ;;;;  ;;;;      ;;;;      ;;  ;;;;;;    
;;;;;;  ;;          ;;;;      ;;;;    ;;  ;;;;    
;;          ;;  ;;;;;;        ;;  ;;  ;;;;;;  ;;;;
;;  ;;        ;;  ;;;;      ;;    ;;          ;;  
;;    ;;  ;;;;  ;;;;;;    ;;;;;;;;;;;;;;;;  ;;;;;;
                ;;    ;;    ;;;;;;      ;;        
;;;;;;;;;;;;;;  ;;;;;;    ;;  ;;;;  ;;  ;;    ;;;;
;;          ;;    ;;;;;;    ;;  ;;      ;;        
;;  ;;;;;;  ;;  ;;    ;;;;;;;;;;;;;;;;;;;;;;;;;;  
;;  ;;;;;;  ;;  ;;;;  ;;    ;;    ;;;;  ;;;;  ;;;;
;;  ;;;;;;  ;;  ;;  ;;  ;;  ;;  ;;;;;;;;  ;;;;  ;;
;;          ;;  ;;    ;;;;    ;;  ;;;;  ;;;;    ;;
;;;;;;;;;;;;;;  ;;  ;;;;;;;;;;      ;;;;;;;;;;;;;;
`);

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
const __name__ = '__main__';

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

const dom = {
  flipper: $('#flipper'),
  resultImage: $('#result > .image'),
  buttons: $('#buttons'),
  uvButtons: $$('#buttons > .button.u, #buttons > .button.v'),
  rerollButton: $('#buttons > .button.r'),
  progress: {
    bar: $('#result > .progress'),
    hint: $('#result > .hint')
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
// url = string / null => show image with url / not show
const showImage = (url) => {
  if (!url) {
    dom.resultImage.style.opacity = 0;
  } else {
    dom.resultImage.src = './img/placeholder.png';
    setTimeout(() => {
      dom.resultImage.src = url;
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
    this.value = 0;
    this.loop = setInterval(() => {
      this.value = Math.min(this.value + Math.random(), 99.99);
      dom.progress.bar.style.width = `${parseInt(this.value)}%`;
      dom.progress.hint.textContent = `${parseInt(this.value)}%`;
    }, 400);
  },
  stop: () => new Promise((resolve) => {
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
  dom.gallery.list.innerHTML = '';
  const collections = ls.get('collections');
  for (let item of (collections ?? [])) {
    dom.gallery.list.innerHTML += `
      <div class="item" onclick="gotoSession(
          '${item.id}',
          '${item.imageUrl?.replaceAll("'", "\\'")}',
          '${item.basePrompt?.replaceAll("'", "\\'")}',
          '${item.prompt?.replaceAll("'", "\\'")}'
        )">
        <span class="main"> ${item.basePrompt} </span>
        <span class="sub"> #${item.id} </span>
      </div>
    `;
  }
};
// rebuild session from data
const gotoSession = (id, imageUrl, basePrompt, prompt) => {
  // don't run it, just goto image
  flip(false);
  showImage(imageUrl);
  // match basePrompt for upscales
  if (basePrompt.match(/ > U[1-4]$/)) {
    return showButtons(1);
  }
  // otherwise we need to enable u/v
  currentSession = new Session({
    type: 'imagine',
    id,
    basePrompt,
    prompt
  });
  // no reroll for variations
  if (basePrompt.match(/ > V[1-4]$/)) {
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
  }
  // params => this.id
  async send() {
    const res = await fetch('/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth': 'lastjourney/ojbk'
      },
      body: JSON.stringify({
        type: this.type,
        prompt: this.prompt,
        id: this.from.id,
        num: this.from.num
      })
    });
    if (!res.ok) {
      return alert(`发生错误 ${res.status}`);
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
        'auth': 'lastjourney/ojbk'
      },
      body: JSON.stringify({
        id: this.id
      })
    });
    if (res.status === 504) {
      return this.collect();
    } else if (!res.ok) {
      return alert(`发生错误 ${res.status}`);
    }
    return this.imageUrl = await res.text();
  }
  // add to history collections
  async toCollections() {
    console.log('to collections');
    const collections = ls.get('collections') ?? [];
    // skip if something with the same id exists
    // oh god fuck why does [].filter() return a truthy []?
    if (collections.filter((item) => (item.id === this.id)).length) return;
    // append
    ls.set('collections', [...collections, {
      id: this.id,
      imageUrl: this.imageUrl,
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
    await this.send();
    await this.collect();
    await progress.stop();
    showImage(this.imageUrl);
    this.toCollections();
    updateCollections();
    if (this.type === 'upscale') showButtons(1);
    else if (this.type === 'variation') showButtons(2);
    else showButtons(3);
    return stat = 'free';
  }
}

// button bound imagine
const imagine = async () => {
  const basePrompt = dom.crafter.prompt.value.replace('\n','').trim();
  if (!basePrompt) {
    return alert('内容不能为空');
  }
  let prompt = basePrompt;
  for (let attr of dom.crafter.attributes) {
    prompt += ` ${attr.value}`;
  }
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

if (__name__ == '__main__') {
  updateCollections();
}