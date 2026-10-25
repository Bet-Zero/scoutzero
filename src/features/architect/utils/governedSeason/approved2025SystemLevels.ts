/** BZE-329 owner-approved exception for one retained release and five fields. */
export const APPROVED_2025_SYSTEM_LEVEL_SOURCE = Object.freeze({
  sourceRecordId: 'POSTCANON-SRC-0002',
  certificationRecordId: 'POSTCANON-CERT-0002',
  officialUrl: 'https://www.nba.com/news/nba-salary-cap-set-2025-26-season',
  artifactSha256:
    'b7c042f32d78fa11174e19800c014c56d6a77e6ee9668c64787d064caa5a042c',
  artifactByteSize: 299783,
  retainedArtifactPath:
    'docs/reference/cba/source-artifacts/post-canon/2025-26-salary-cap.b7c042f32d78fa11174e19800c014c56d6a77e6ee9668c64787d064caa5a042c.html',
  publicationDate: '2025-06-30',
  salaryCapYear: 2026,
});

export const APPROVED_2025_SYSTEM_LEVEL_FIELDS = Object.freeze([
  Object.freeze({
    fieldId: 'salary-cap',
    sourceText:
      'Salary Cap has been set at $154.647 million for the 2025-26 season.',
    normalizedValue: '154647000',
  }),
  Object.freeze({
    fieldId: 'minimum-team-salary',
    sourceText:
      'The Minimum Team Salary is $139.182 million for the 2025-26 season.',
    normalizedValue: '139182000',
  }),
  Object.freeze({
    fieldId: 'tax-level',
    sourceText: 'The Tax Level for the 2025‑26 season is $187.895 million.',
    normalizedValue: '187895000',
  }),
  Object.freeze({
    fieldId: 'first-apron',
    sourceText:
      'The First Apron Level is $195.945 million for the 2025-26 season.',
    normalizedValue: '195945000',
  }),
  Object.freeze({
    fieldId: 'second-apron',
    sourceText:
      'The Second Apron Level is $207.824 million for the 2025-26 season.',
    normalizedValue: '207824000',
  }),
]);
