export function dedupArray<T>(arr: T[]): T[] {
  return arr.filter((value, index) => arr.indexOf(value) === index);
}

export async function resolveAndReturn<T>(promises: Promise<T>[]): Promise<{ successes: T[]; failures: PromiseRejectedResult[] }> {
  const promiseResults = await Promise.allSettled(promises);
  const successes = [];
  const failures = [];
  for (const result of promiseResults) {
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      failures.push(result);
    }
  }
  return { successes, failures };
}
