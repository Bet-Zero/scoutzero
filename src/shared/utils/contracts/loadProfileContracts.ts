/** Load validated contracts without discarding unqualified retained source records. */
import { ContractDocZ, type ContractDoc } from '@/schemas/players_v2';

export function loadProfileContracts(
  documents: readonly { id: string; data: unknown }[],
  collectionPath: string
) {
  const contracts: Record<string, ContractDoc> = {};
  const withheld: { id: string; detail: string; explicitlyCurrent: boolean }[] = [];
  for (const document of documents) {
    if (document.id.startsWith('last_')) continue;
    const result = ContractDocZ.safeParse(document.data);
    if (result.success) {
      contracts[document.id] = result.data;
    } else {
      const source = document.data as { metadata?: { isCurrent?: unknown } } | null;
      withheld.push({ id: document.id,
        explicitlyCurrent: source?.metadata?.isCurrent === true,
        detail: result.error.issues.map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; '),
      });
    }
  }
  const validCurrent = Object.values(contracts).some(contract => contract.metadata.isCurrent);
  const blocking = withheld.find(record => record.explicitlyCurrent) || (!validCurrent ? withheld[0] : undefined);
  if (blocking) throw new Error(`${collectionPath}/${blocking.id} failed schema validation: ${blocking.detail}`);
  return { contracts, withheldIds: withheld.map(record => record.id),
    warnings: withheld.length ? [`${withheld.length} contract record${withheld.length === 1 ? '' : 's'} need${withheld.length === 1 ? 's' : ''} review. Contract history may be incomplete.`] : [],
  };
}
