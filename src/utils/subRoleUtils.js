import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

export const isPositiveSubRole = (roleName) => {
  const role = SubRoleMasterList.find((r) => r.name === roleName);
  return role?.isPositive;
};
