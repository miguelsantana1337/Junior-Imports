const lower = "abcdefghijkmnpqrstuvwxyz";
const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const digits = "23456789";
const symbols = "!@#$%&*+-_";
const all = `${lower}${upper}${digits}${symbols}`;

function randomIndex(length: number) {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] % length;
}

function pick(characters: string) {
  return characters[randomIndex(characters.length)];
}

export function generateTemporaryPassword(length = 16) {
  const safeLength = Math.max(12, Math.min(length, 72));
  const characters = [
    pick(lower),
    pick(upper),
    pick(digits),
    pick(symbols),
    ...Array.from({ length: safeLength - 4 }, () => pick(all)),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }

  return characters.join("");
}
