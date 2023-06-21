export const randint = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const sleep = (ms) => (
  new Promise(resolve => setTimeout(resolve, ms))
);

const uidChars = '0123456789ACEFGHJKLMNPQRTVWXYZ';
export function generateUid(len=6) {
  let res = '';
  for (let i = 0; i < len; i++) {
    res += uidChars[randint(0, uidChars.length-1)];
  }
  return res;
}

export const getTime = () => {
  const date = new Date();
  const
    year = date.getFullYear() % 100,
    month = String(date.getMonth() + 1).padStart(2, '0'),
    day = String(date.getDate()).padStart(2, '0'),
    hours = String(date.getHours()).padStart(2, '0'),
    minutes = String(date.getMinutes()).padStart(2, '0'),
    seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}/${hours}:${minutes}:${seconds}`;
}