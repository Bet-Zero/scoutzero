export function getColor(rating) {
  const colorMap = [
    [100, '#13895b'],
    [97, '#369972'],
    [94, '#55b48f'],
    [91, '#6cbd9d'],
    [86, '#8bc8b0'],
    [80, '#bce6df'],
    [73, '#d9efe6'],
    [66, '#efd9d9'],
    [56, '#e6bcbc'],
    [46, '#c88b8b'],
    [41, '#bd6c6c'],
    [36, '#b45555'],
    [26, '#993636'],
    [0, '#891313'],
  ];
  return colorMap.find(([threshold]) => rating >= threshold)[1];
}
