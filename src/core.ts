import * as cp from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { ISSUE_COMMENT_TEMPLATE, LINKED_ISSUE_REGEXES, PR_COMMENT_TEMPLATE } from './constants';
import { GithubIssue, GithubPullRequest, GithubRelease } from './types';
import { dedupArray, resolveAndReturnSuccesses } from './util';

export enum ActionMode {
  /**
   * Backfills previous pull requests and issues with release reminders
   * for all previous releases as a bulk operation.
   *
   * The operation will finish when the max-backfill-operations limit is
   * reached, or when all releases have been backfilled.
   */
  ALL = 'all',

  /**
   * Add release reminders to issues and pull requests for only the
   * latest available release.
   */
  LATEST = 'latest'
}

export interface ActionOptions {
  /**
   * Mode of running the action.
   * @default ActionMode.LATEST
   */
  readonly mode?: ActionMode;

  /**
   * Maximum number of comments to apply while running the action.
   * @default 50
   */
  readonly maximumComments?: number;
}

function getContext() {
  core.debug(`owner: ${github.context.repo.owner}`);
  core.debug(`repo: ${github.context.repo.repo}`);
  return github.context.repo;
}

function getOptions(): ActionOptions {
  core.debug(`mode: ${core.getInput('mode')}`);
  core.debug(`maximum-comments: ${core.getInput('maximum-comments')}`);

  const mode: ActionMode | undefined = (<any>ActionMode)[core.getInput('mode')];
  const maximumComments: number = parseInt(core.getInput('maximum-comments'), 10); // may be NaN
  const options = {
    mode: mode ?? ActionMode.LATEST,
    maximumComments: maximumComments || 50,
  };

  core.debug(`options: ${JSON.stringify(options)}`);

  return options;
}

type HydratedOctokit = ReturnType<typeof github.getOctokit>

export class GithubClient {
  private readonly octokit: HydratedOctokit;
  private readonly owner: string;
  private readonly repo: string;
  constructor(octokit: HydratedOctokit, owner: string, repo: string) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
  }

  async getLatestRelease(): Promise<GithubRelease> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/releases/latest`);
    core.debug(`getLatestRelease: (${response.status}) ${response.data?.name}`);

    return response.data;
  }

  async getPullRequestsFromCommit(commitSha: string): Promise<GithubPullRequest[]> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/commits/${commitSha}/pulls`, {
      // specify a media type because this feature is in preview
      mediaType: {
        previews: ['groot'],
      },
    });
    core.debug(`getPullRequestsFromCommit: (${response.status}) ${response.data?.map((pr: GithubPullRequest) => pr.url).join('\n')}`);

    return response.data;
  }

  async getIssue(issueNumber: number): Promise<GithubIssue> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/issues/${issueNumber}`);
    core.debug(`getIssue: (${response.status}) #${response.data?.number}`);

    return response.data;
  }

  async addComment(issueNumber: number, body: string): Promise<void> {
    core.debug(`adding comment to #${issueNumber}...`);
    await this.octokit.request(`POST /repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`, {
      body: body,
    });
  }
}

export class GitClient {
  private readonly workspace: string;
  constructor() {
    this.workspace = this.setupWorkspace();
  }

  setupWorkspace() {
    if (!process.env.GITHUB_WORKSPACE) {
      throw new Error('GITHUB_WORKSPACE is not set in the current repository!');
    }
    return process.env.GITHUB_WORKSPACE;
  }

  /**
   * Returns the tag that preceeds the provided one, if any. If this errors
   * with a valid tag, it is likely that the repository hasn't been updated
   * with the latest tags and a `git fetch` needs to be run.
   */
  getPreviousTag(tag: string): string {
    return cp.execSync(`git describe --tags --abbrev=0 ${tag}^`, { cwd: this.workspace }).toString().trim();
  }

  /**
   * Returns a list of commit hashes AFTER fromTag, up to and
   * INCLUDING toTag.
   */
  getCommitsBetweenTags(fromTag: string, toTag: string): string[] {
    return cp.execSync(`git rev-list ${fromTag}..${toTag}`).toString().trim().split('\n');
  }
}

export async function getPullRequests(gitClient: GitClient, githubClient: GithubClient, release: GithubRelease): Promise<GithubPullRequest[]> {
  core.debug(`getting pull requests for release: ${release.name}`);

  const tag = release.tag_name;
  core.debug(`tag: ${tag}`);

  const previousTag = gitClient.getPreviousTag(tag);
  core.debug(`previousTag: ${previousTag}`);

  const commits = gitClient.getCommitsBetweenTags(previousTag, tag);
  core.debug(`commits: ${commits}`);

  const promises = commits.map((commitSha) => githubClient.getPullRequestsFromCommit(commitSha));
  const pullRequests: GithubPullRequest[] = (await resolveAndReturnSuccesses(promises)).flat();

  // TODO: validate that the pull request was actually merged?
  // https://docs.github.com/en/rest/reference/pulls#check-if-a-pull-request-has-been-merged

  core.debug(`pullRequests: ${pullRequests.map(pr => pr.url)}`);

  return pullRequests;
}

/**
 * Returns a list of issue numbers mentioned in a pull request description.
 * @see https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
 */
export function parseIssueNumbers(description: string): number[] {
  const output = [];
  for (const re of LINKED_ISSUE_REGEXES) {
    const matches = description.toLowerCase().matchAll(re);
    for (const match of matches) {
      const issueNumber = match[1]; // grab the captured group
      output.push(parseInt(issueNumber));
    }
  }
  return output;
}

export async function getLinkedIssues(githubClient: GithubClient, pullRequest: GithubPullRequest): Promise<GithubIssue[]> {
  core.debug(`getting linked issues for pull request: #${pullRequest.number}`);

  const prBody = pullRequest.body.toLowerCase();
  const issueNumbers: number[] = dedupArray(parseIssueNumbers(prBody));
  core.debug(`issue numbers found: [${issueNumbers.map((num) => '#' + num).join(',')}]`);

  const issues: GithubIssue[] = await resolveAndReturnSuccesses(issueNumbers.map((issueNum) => githubClient.getIssue(issueNum)));
  core.debug(`issues: ${issues.map(issue => issue.url).join('\n')}`);

  return issues;
}

// TODO: filter out PRs/issues that have already been commented on
export async function commentOn(
  githubClient: GithubClient,
  pullRequest: GithubPullRequest,
  issues: GithubIssue[],
  repo: string,
  release: GithubRelease,
): Promise<number> {
  const promises = [];

  const prMessage = PR_COMMENT_TEMPLATE(repo, release.name);
  promises.push(githubClient.addComment(pullRequest.number, prMessage));

  for (const issue of issues) {
    const issueMessage = ISSUE_COMMENT_TEMPLATE(pullRequest.number, repo, release.name);
    promises.push(githubClient.addComment(issue.number, issueMessage));
  }

  const results = await Promise.allSettled(promises);
  let total = 0;
  for (const result of results) {
    if (result.status === 'rejected') {
      core.error(`could not comment on issue/pr: ${result.reason}`);
      continue;
    }
    total += 1;
  }
  return total;
}

export async function run(): Promise<void> {
  try {
    const options = getOptions();
    const { owner, repo } = getContext();

    if (options.mode !== ActionMode.LATEST) {
      throw new Error('Only "latest" mode is currently supported.');
    }

    const token = core.getInput('token', { required: true });

    if (token === 'DEBUG_TOKEN') {
      core.info('DEBUG_TOKEN has been provided, exiting early.');
      core.setOutput('total-comments', 0);
      return;
    }

    const octokit = github.getOctokit(token);
    const githubClient = new GithubClient(octokit, owner, repo);
    const gitClient = new GitClient();

    const latestRelease = await githubClient.getLatestRelease();
    const pullRequests = await getPullRequests(gitClient, githubClient, latestRelease);

    let totalComments = 0;
    for (const pullRequest of pullRequests) {
      const issues = await getLinkedIssues(githubClient, pullRequest);
      totalComments += await commentOn(githubClient, pullRequest, issues, repo, latestRelease);
    }

    core.setOutput('total-comments', totalComments);
  } catch (error) {
    core.setFailed(error.message);
  }
}