/**
 * A tag to include in all comments to allow the GitHub action detect if it
 * has already posted in a given issue, without being tied to the exact
 * messaging of the comment(s).
 */
export const GITHUB_RELEASE_NOTIFIER_TAG = '__GITHUB_RELEASE_NOTIFIER__';

export const LINKED_ISSUE_REGEXES = [
  /close #(\d+)/g,
  /closes #(\d+)/g,
  /closed #(\d+)/g,
  /fix #(\d+)/g,
  /fixes #(\d+)/g,
  /fixed #(\d+)/g,
  /resolve #(\d+)/g,
  /resolves #(\d+)/g,
  /resolved #(\d+)/g,
];

export const ISSUE_COMMENT_TEMPLATE = (prNum: number, release: string, releaseUrl: string) => `<!-- ${GITHUB_RELEASE_NOTIFIER_TAG} -->\nThis issue has been resolved by pull request #${prNum}, and the changes are now available in release [${release}](${releaseUrl}}). If the problem isn't resolved, please @mention a maintainer or open a new issue that references this one.\n\nIf this message has appeared incorrectly, please post a bug report on https://github.com/Chriscbr/github-release-notifier. Thanks!`;
export const PR_COMMENT_TEMPLATE = (release: string, releaseUrl: string) => `<!-- ${GITHUB_RELEASE_NOTIFIER_TAG} -->\nThe changes in this pull request are now available in release [${release}](${releaseUrl})! If you have further questions, please open a new issue that references this PR.\n\nIf this message has appeared incorrectly, please post a bug report on https://github.com/Chriscbr/github-release-notifier. Thanks!`;
