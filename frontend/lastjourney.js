'use strict';

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

const sleep = (ms) => (
  new Promise(resolve => setTimeout(resolve, ms))
);

let stat = 'free';
let currentSession = null;

const dom = {
  flipper: $('#flipper'),
  resultImage: $('#result > .image'),
  actionButtons: $('#buttons'),
  progress: {
    bar: $('#result > .progress'),
    hint: $('#result > .hint')
  },
  crafter: {
    prompt: $('#crafter .prompt'),
    model: $('#crafter .model'),
    aspectRatio: $('#crafter .aspect-ratio'),
    chaos: $('#crafter .chaos'),
    mode: $('#crafter .mode'),
    translate: $('#crafter .translate')
  },
  sendButton: $('#crafter #finish')
};

const flip = (x) => {
  if (x) {
    dom.flipper.classList.remove('move');
    dom.flipper.classList.add('flip');
  } else {
    dom.flipper.classList.remove('flip');
  }
}
const showButtons = (x) => {
  if (x) {
    dom.flipper.classList.remove('flip');
    dom.flipper.classList.add('move');
    dom.actionButtons.style.opacity = '1';
    dom.actionButtons.style.pointerEvents = 'auto';
  } else {
    dom.flipper.classList.remove('move');
    dom.actionButtons.style.opacity = '0';
    dom.actionButtons.style.pointerEvents = 'none';
  }
}
const showImage = (url) => {
  if (url) {
    dom.resultImage.src = url;
    dom.resultImage.style.opacity = 1;
  } else {
    dom.resultImage.style.opacity = 0;
  }
}

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
    }, 500)
  })
};

// prompt => id
class Session {
  constructor(params) {
    this.type = params.type ?? 'imagine';
    this.prompt = params.prompt;
    this.from = params.from ?? {}
    this.id = null;
    this.imageUrl = null;
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
      return alert(`send error ${res.status}`);
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
      return alert(res.status);
    }
    return this.imageUrl = await res.text();
  }
  // run it
  async run() {
    if (stat !== 'free') return alert('有正在进行的任务');
    stat = 'working';
    flip(false);
    showButtons(false);
    showImage(false);
    progress.start();
    await this.send();
    await this.collect();
    await progress.stop();
    showImage(this.imageUrl);
    setTimeout(() => {
      showButtons(true);
    }, 1500);
    return stat = 'free';
  }
}

// onclick imagine
dom.sendButton.onclick = async () => {
  const basePrompt = dom.crafter.prompt.value.replace('\n','');
  if (!basePrompt) {
    return alert('内容不能为空');
  }
  const prompt = 
    basePrompt + ' ' +
    dom.crafter.model.value + ' ' +
    dom.crafter.aspectRatio.value + ' ' +
    dom.crafter.chaos.value;
  currentSession = new Session({
    type: 'imagine',
    prompt
  });
  await currentSession.run();
};

// button bound upscale
const upscale = async (x) => {
  currentSession = new Session({
    type: 'upscale',
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
    prompt: currentSession.prompt
  });
  await currentSession.run();
}

// button bound exit
const exitSession = () => {
  if (stat !== 'free') return alert('有绘图任务未结束');
  showButtons(false);
  showImage(false);
  flip(true);
}