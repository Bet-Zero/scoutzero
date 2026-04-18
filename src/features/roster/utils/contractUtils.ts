type ContractLike = {
  signedUsing?: string | null;
  contractType?: string | null;
};

type PlayerWithContractLike = {
  contract?: ContractLike | null;
  primaryContract?: ContractLike | null;
  contracts?: Record<string, ContractLike | null | undefined> | null;
  contractView?: ContractLike | null;
};

export function isTwoWayContract(
  player: PlayerWithContractLike | null | undefined
): boolean {
  if (!player) return false;

  const contract =
    player.contract ||
    player.primaryContract ||
    (player.contracts ? Object.values(player.contracts)[0] : null) ||
    player.contractView ||
    null;

  const fieldsToCheck = [
    typeof contract?.signedUsing === 'string' ? contract.signedUsing : null,
    typeof contract?.contractType === 'string' ? contract.contractType : null,
  ];

  return fieldsToCheck.some(
    (val) =>
      typeof val === 'string' &&
      ['two-way', 'two way', 'two_way'].some((keyword) =>
        val.toLowerCase().includes(keyword)
      )
  );
}
