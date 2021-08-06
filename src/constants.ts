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

export const ISSUE_COMMENT_TEMPLATE = (prNum: number, repoName: string, release: string, releaseUrl: string) => `This issue has been resolved by pull request #${prNum}, and the changes are now available in release [${release}](${releaseUrl}}) of ${repoName}. If the issue isn't resolved, please @mention a maintainer or open a new issue that references this one.\n\nIf this message has appeared incorrectly, please post an issue on https://github.com/Chriscbr/github-release-notifier.`;
export const PR_COMMENT_TEMPLATE = (repoName: string, release: string, releaseUrl: string) => `The changes in this pull request are now available in release [${release}](${releaseUrl}) of ${repoName}! If there are further issues, please open a new issue that references this PR.\n\nIf this message has appeared incorrectly, please post an issue on https://github.com/Chriscbr/github-release-notifier.`;
