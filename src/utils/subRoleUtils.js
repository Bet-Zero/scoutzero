import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

export const isPositiveSubRole = (roleName) => {
  const role = SubRoleMasterList.find((r) => r.name === roleName);
  return role?.isPositive;
};

export const toggleSubroleSelection = (subRoles = {}, roleName) => {
  const roleData = SubRoleMasterList.find((r) => r.name === roleName);
  if (!roleData) return subRoles;

  const { type } = roleData;
  const currentList = subRoles[type] || [];
  return {
    ...subRoles,
    [type]: currentList.includes(roleName)
      ? currentList.filter((r) => r !== roleName)
      : [...currentList, roleName],
  };
};
