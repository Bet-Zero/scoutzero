export function isTwoWayContract(player) {
  const summary = player?.contract_summary || {};
  const fieldsToCheck = [summary.signed_using, summary.type];
  return fieldsToCheck.some(
    (val) =>
      typeof val === 'string' &&
      ['two-way', 'two way', 'two_way'].some((keyword) =>
        val.toLowerCase().includes(keyword)
      )
  );
}
