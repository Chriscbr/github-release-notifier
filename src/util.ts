export function dedupArray<T>(arr: T[]): T[] {
  return arr.filter((value, index) => arr.indexOf(value) === index);
}
