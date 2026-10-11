import {
  INSPECTION_ENVIRONMENT,
  PUBLICATION_ENVIRONMENT,
} from './draftReviewDeploymentPlan.js';

export function verifyProtection(environment: unknown, mode: string) {
  const value = environment as any;
  const name =
    mode === 'inspect'
      ? INSPECTION_ENVIRONMENT
      : mode === 'publish'
        ? PUBLICATION_ENVIRONMENT
        : '';
  const rules = value?.protection_rules;
  const reviewer =
    Array.isArray(rules) &&
    rules.find((rule: any) => rule.type === 'required_reviewers');
  if (
    !name ||
    value?.name !== name ||
    value?.can_admins_bypass !== false ||
    (mode === 'publish' &&
      (!reviewer?.reviewers?.some(
        (entry: any) =>
          entry.type === 'User' && entry.reviewer?.id === 205859440
      ) ||
        reviewer.reviewers.length !== 1)) ||
    value.deployment_branch_policy?.protected_branches !== false ||
    value.deployment_branch_policy?.custom_branch_policies !== true
  )
    throw new Error('PRODUCTION_PROTECTION_REQUIRED');
}
