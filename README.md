# github-release-notifier

> Note: **`github-release-notifier` is no longer being maintained.** I created this initially as a solution for resolving the inconvenience that it's hard to find out which "release" a pull request was first included in. However, I later discovered that the [refined-github](https://github.com/sindresorhus/refined-github) browser extension automatically shows the first Git tag was included in ([see this screenshot](https://user-images.githubusercontent.com/16872793/81943321-38ac4300-95c9-11ea-8543-0f4858174e1e.png)). Since this solution is significantly less intrusive than a GitHub action, I've decided to use that instead. Anyone is still welcome to use and adapt this code per the repository's license.

`github-release-notifier` is a GitHub Action that will automatically add comments to issues and pull requests, notifying subscribers about which release their bug fix or feature was included in. This has two main benefits:

- Updating contributors when their contributions have been made broadly available (especially if releases are infrequent).
- Enabling users to quickly determine which version of the application/library the issue was fixed in, without having to sift through changelogs or git commit histories. (For example, if you have v5 of a CLI downloaded, and you see an important bug fix was merged through a pull request, you might want to know if the commit was in a release before v5 or after v5, in order to decide whether you need to upgrade).

## Usage

```
 my_post_release_job:
    needs: my_release_job
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - uses: Chriscbr/github-release-notifier@v1
        with:
          mode: latest
```
