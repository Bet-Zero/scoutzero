const getCapPercentage = (salary, salaryCap) => {
  if (!salary || !salaryCap) return null;

  const percent = (salary / salaryCap) * 100;
  return parseFloat(percent.toFixed(1)); // e.g. 27.8
};

export default getCapPercentage;
