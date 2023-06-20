'use strict';

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

const sleep = (ms) => (
  new Promise(resolve => setTimeout(resolve, ms))
);

let stat = 'free';

const dom = {
  flipper: $('#flipper'),
  resultImage: $('#result > .image'),
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

const flip = () => {
  dom.flipper.classList.toggle('flip');
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
  stop: () => {
    clearInterval(this.loop);
    dom.progress.bar.style.width = `0%`;
    dom.progress.hint.textContent = '';
  }
};

// prompt => id
const imagine = async (prompt) => {
  const res = await fetch('/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'auth': 'lastjourney/ojbk'
    },
    body: JSON.stringify({
      type: 'imagine',
      prompt
    })
  });
  if (!res.ok) {
    return alert(`imagine error ${res.status}`);
  }
  return await res.text();
}

// id => url
const collect = async (id) => {
  await sleep(10000);
  const res = await fetch('/result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'auth': 'lastjourney/ojbk'
    },
    body: JSON.stringify({
      id
    })
  });
  if (res.status === 504) {
    return collect(id);
  } else if (!res.ok) {
    return alert(res.status);
  }
  return await res.text();
}

dom.sendButton.onclick = async () => {
  if (stat !== 'free') return;
  stat = 'working';
  const basePrompt = dom.crafter.prompt.value.replace('\n','');
  if (!basePrompt) {
    stat = 'free';
    return alert('内容不能为空');
  }
  const prompt = 
    basePrompt + ' ' +
    dom.crafter.model.value + ' ' +
    dom.crafter.aspectRatio.value + ' ' +
    dom.crafter.chaos.value;
  const id = await imagine(prompt);
  flip();
  progress.start();
  const url = await collect(id);
  progress.stop();
  dom.resultImage.src = url;
  dom.resultImage.style.opacity = 1;
}