New + 6 - 0;
export function normalizePlayerId(id = '') {
  return id
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
