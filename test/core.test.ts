import { parseIssueNumbers } from '../src/core';

describe('issue number parsing', () => {
  test('base cases', () => {
    expect(new Set(parseIssueNumbers('hello world!'))).toEqual(new Set([]));
    expect(new Set(parseIssueNumbers('closes #3, closed #4, close #5!'))).toEqual(new Set([3, 4, 5]));
    expect(new Set(parseIssueNumbers('resolved #3, resolve #4, resolves #5!'))).toEqual(new Set([3, 4, 5]));
    expect(new Set(parseIssueNumbers('fix #3, fixed #4, fixes #5!'))).toEqual(new Set([3, 4, 5]));
  });

  test('ignore capitalization', () => {
    expect(new Set(parseIssueNumbers('CLOSED #3, fIXES #4, Resolves #5!'))).toEqual(new Set([3, 4, 5]));
  });

  test('works with large numbers', () => {
    expect(new Set(parseIssueNumbers('this resolves #12345'))).toEqual(new Set([12345]));
  });
});
