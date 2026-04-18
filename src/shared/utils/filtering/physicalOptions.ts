export type SelectOption = { value: number; label: string };

export const generateHeightOptions = (): SelectOption[] => {
  const options: SelectOption[] = [];
  for (let feet = 5; feet <= 7; feet++) {
    for (let inches = 0; inches < 12; inches++) {
      if (feet === 7 && inches > 6) break;
      const totalInches = feet * 12 + inches;
      options.push({ value: totalInches, label: `${feet}'${inches}"` });
    }
  }
  return options;
};

export const generateWeightOptions = (): SelectOption[] => {
  const options: SelectOption[] = [];
  for (let weight = 150; weight <= 350; weight += 10) {
    options.push({ value: weight, label: `${weight} lbs` });
  }
  return options;
};

export const generateAgeOptions = (): SelectOption[] => {
  const options: SelectOption[] = [];
  for (let age = 18; age <= 45; age++) {
    options.push({ value: age, label: `${age}` });
  }
  return options;
};
