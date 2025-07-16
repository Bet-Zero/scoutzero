const getCapPercentage = (salary, capSettings) => {
  if (!salary || !capSettings?.cap) return null;

  const cap = capSettings.cap;
  const percent = (salary / cap) * 100;
  return parseFloat(percent.toFixed(1)); // e.g. 27.8
};

export default getCapPercentage;
