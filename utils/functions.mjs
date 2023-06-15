export function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getTime() {
  let date = new Date();
  let year = date.getFullYear() % 100,
      month = String(date.getMonth() + 1).padStart(2, '0'),
      day = String(date.getDate()).padStart(2, '0'),
      hours = String(date.getHours()).padStart(2, '0'),
      minutes = String(date.getMinutes()).padStart(2, '0'),
      seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}/${hours}:${minutes}:${seconds}`;
}