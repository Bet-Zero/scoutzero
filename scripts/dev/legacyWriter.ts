/** Old bulk writers cannot enforce reviewed deltas or preserve history. */
export function stopLegacyWriter(): never {
  throw new Error('Legacy bulk publication is retired. Use the reviewed maintenance publication plan; draft installation stays on its separately approved release route. No writes performed.');
}
