export function unique<T>(list: T[]) {
  return Array.from(new Set<T>(list.filter(Boolean)));
}

export function flat<T>(array: T[][], depth = 1): T[] {
  const flattend = [];

  for (const el of array) {
    if (Array.isArray(el) && depth) {
      flat(el as T[][], depth - 1).forEach((el) => flattend.push(el));
    } else {
      flattend.push(el);
    }
  }

  return flattend as T[];
}
