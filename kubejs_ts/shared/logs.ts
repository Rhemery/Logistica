export function logProgress(namespace: string, current: number, total: number) {
  const result = (current / total) * 100;
  if ((current % total) / 100 !== 0) return;

  console.infof(`[${namespace}] ${result.toFixed(0)}%`);
}
