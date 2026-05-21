export function logProgress(namespace: string, current: number, total: number) {
  if (current % 1000 !== 0) return;
  const result = (current / total) * 100;
  console.infof(`[${namespace}] ${result.toFixed(2)} Percent`);
}
