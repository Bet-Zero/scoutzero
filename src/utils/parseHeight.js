export default function parseHeight(ht = '0-0') {
  const parts = String(ht).split('-');
  return parseInt(parts[0]) * 12 + parseInt(parts[1]);
}
