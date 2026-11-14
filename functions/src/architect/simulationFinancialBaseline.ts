/** SIMULATION financial input: local file, or a pinned live object when switched on. */
import {
  readSimulationPackageBytes,
  type ReadStorageObject,
} from './simulationPackageSource';
import {
  loadTrustedContractRelease,
  parseTrustedContractReleaseArtifact,
  type TrustedContractRelease,
  type TrustedContractReleaseDescriptor,
  type TrustedContractReleasePin,
} from './trustedContractBaseline';

type SimulationPackage = {
  classification: 'SIMULATION';
  asOf: string;
  seasonId: string;
  teams: Record<string, Record<string, unknown>>;
  /** Private contract bytes bound by the financial package's operator pin. */
  contractRelease?: {
    descriptor: TrustedContractReleaseDescriptor;
    artifact: string;
  };
};

/** The authenticated package may select a new starting release, never a client. */
export function simulationContractRelease(
  baseline: SimulationPackage | null,
  parentPin?: TrustedContractReleasePin
): TrustedContractRelease {
  const packaged = baseline?.contractRelease;
  if (
    packaged &&
    (!parentPin ||
      (parentPin.releaseId === packaged.descriptor.releaseId &&
        parentPin.releaseVersion === packaged.descriptor.releaseVersion &&
        parentPin.releaseDigest === packaged.descriptor.releaseDigest))
  ) {
    const release = parseTrustedContractReleaseArtifact(
      Buffer.from(packaged.artifact, 'utf8'),
      packaged.descriptor
    );
    if (
      release.effectiveAt !== baseline!.asOf ||
      `${release.salaryCapYear - 1}-${String(release.salaryCapYear).slice(-2)}` !==
        baseline!.seasonId
    )
      throw new Error('Simulation and Contract baseline dates differ.');
    return release;
  }
  // Retained historical worlds keep their exact release when copied.
  return loadTrustedContractRelease(parentPin);
}
export async function loadSimulationFinancialBaseline(
  readObject?: ReadStorageObject
): Promise<SimulationPackage | null> {
  const bytes = await readSimulationPackageBytes('financial', readObject);
  if (!bytes) return null;
  const value = JSON.parse(bytes.toString()) as SimulationPackage;
  if (
    value.classification !== 'SIMULATION' ||
    !value.teams ||
    Object.keys(value.teams).length !== 30 ||
    Object.entries(value.teams).some(
      ([code, team]) => !/^[A-Z]{3}$/.test(code) || team.teamCode !== code
    )
  )
    throw new Error('Expected the prepared thirty-team SIMULATION baseline.');
  if (value.contractRelease) simulationContractRelease(value);
  return value;
}
