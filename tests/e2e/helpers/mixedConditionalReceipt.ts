type JourneyReceipt = {
  candidate: string;
  packageSha256: string;
  scope: string;
  position: number;
  [key: string]: unknown;
};

/** Join both outcomes only when they prove the same candidate and release. */
export function combineMixedConditionalReceipts(
  candidate: string | undefined,
  journeys: JourneyReceipt[]
) {
  const packageSha256 = journeys[0]?.packageSha256;
  if (
    !candidate ||
    !/^[a-f0-9]{40}$/.test(candidate) ||
    !/^[a-f0-9]{64}$/.test(packageSha256 ?? '') ||
    journeys.length !== 2 ||
    ![10, 11].every((position) =>
      journeys.some((journey) => journey.position === position)
    ) ||
    journeys.some(
      (journey) =>
        journey.candidate !== candidate ||
        journey.packageSha256 !== packageSha256 ||
        journey.scope !== 'governed-simulation-only'
    )
  )
    throw new Error(
      'Mixed conditional receipts need both outcomes from one candidate and release.'
    );
  return {
    candidate,
    packageSha256,
    scope: 'governed-simulation-only',
    journeys,
  };
}
