export function dedupArray<T>(arr: T[]): T[] {
  return arr.filter((value, index) => arr.indexOf(value) === index);
}

export async function resolveAndReturnSuccesses<T>(promises: Promise<T>[]): Promise<T[]> {
  const promiseResults = await Promise.allSettled(promises);
  const output = [];
  for (const result of promiseResults) {
    if (result.status === 'fulfilled') {
      output.push(result.value);
    }
  }
  return output;
}
