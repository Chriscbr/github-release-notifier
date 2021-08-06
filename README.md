# github-release-notifier

`github-release-notifier` is a GitHub Action that will automatically add comments to issues and pull requests, notifying subscribers about which release their bug fix or feature was included in. This has two main benefits:

- Updating contributors when their contributions have been made broadly available (especially if releases are infrequent).
- Enabling users to quickly determine which version of the application/library the issue was fixed in, without having to sift through changelogs or git commit histories. (For example, if you have v5 of a CLI downloaded, and you see an important bug fix was merged through a pull request, you might want to know if the commit was in a release before v5 or after v5, in order to decide whether you need to upgrade).

## Usage
