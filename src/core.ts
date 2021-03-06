import * as cp from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { GITHUB_RELEASE_NOTIFIER_TAG, ISSUE_COMMENT_TEMPLATE, LINKED_ISSUE_REGEXES, PR_COMMENT_TEMPLATE } from './constants';
import { GithubIssue, GithubIssueComment, GithubPullRequest, GithubRelease } from './types';
import { dedupArray, resolveAndReturn } from './util';

/**
 * Determines what releases the action will generate notifications for.
 */
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

/**
 * Options for configuring the action in a GitHub workflow.
 */
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
  core.info(`owner: ${github.context.repo.owner}`);
  core.info(`repo: ${github.context.repo.repo}`);
  return github.context.repo;
}

function getOptions(): ActionOptions {
  core.info(`mode: ${core.getInput('mode')}`);
  core.info(`maximum-comments: ${core.getInput('maximum-comments')}`);

  const mode: ActionMode | undefined = (<any>ActionMode)[core.getInput('mode')];
  const maximumComments: number = parseInt(core.getInput('maximum-comments'), 10); // may be NaN
  const options = {
    mode: mode ?? ActionMode.LATEST,
    maximumComments: maximumComments || 50,
  };

  core.info(`options: ${JSON.stringify(options)}`);

  return options;
}

type HydratedOctokit = ReturnType<typeof github.getOctokit>

export interface GithubClientOptions {
  readonly owner: string;
  readonly repo: string;
}

export class GithubClient {
  private readonly octokit: HydratedOctokit;
  private readonly owner: string;
  private readonly repo: string;

  constructor(octokit: HydratedOctokit, options: GithubClientOptions) {
    this.octokit = octokit;
    this.owner = options.owner;
    this.repo = options.repo;
  }

  /**
   * @see https://docs.github.com/en/rest/reference/repos#get-the-latest-release
   */
  async getLatestRelease(): Promise<GithubRelease> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/releases/latest`);
    core.info(`getLatestRelease: (${response.status}) ${response.data?.name}`);

    return response.data;
  }

  /**
   * @see https://docs.github.com/en/rest/reference/repos#list-pull-requests-associated-with-a-commit
   */
  async getPullRequestsFromCommit(commitSha: string): Promise<GithubPullRequest[]> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/commits/${commitSha}/pulls`, {
      // specify a media type because this feature is in preview
      mediaType: {
        previews: ['groot'],
      },
    });
    core.info(`getPullRequestsFromCommit on commitSha ${commitSha}: (${response.status}) ${response.data.length} pull requests found`);

    return response.data;
  }

  /**
   * @see https://docs.github.com/en/rest/reference/pulls#check-if-a-pull-request-has-been-merged
   */
  async isPullRequestMerged(pullNumber: number): Promise<boolean> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/pulls/${pullNumber}/merge`);
    core.info(`isPullRequestMerged on pull #${pullNumber}: (${response.status})`);

    return response.status === 204;
  }

  /**
   * @see https://docs.github.com/en/rest/reference/issues#get-an-issue
   */
  async getIssue(issueNumber: number): Promise<GithubIssue> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/issues/${issueNumber}`);
    core.info(`getIssue on issue #${issueNumber}: (${response.status}) #${response.data?.number}`);

    return response.data;
  }

  /**
   * @see https://docs.github.com/en/rest/reference/issues#list-issue-comments
   */
  async listIssueComments(issueNumber: number): Promise<GithubIssueComment[]> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`);
    core.info(`listIssueComments on issue #${issueNumber}: (${response.status}) ${response.data.length} comments found`);

    return response.data;
  }

  /**
   * @see https://docs.github.com/en/rest/reference/issues#create-an-issue-comment
   */
  async createComment(issueNumber: number, body: string): Promise<void> {
    const response = await this.octokit.request(`POST /repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`, {
      body: body,
    });
    core.info(`createComment on issue #${issueNumber}: (${response.status})`);
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
  core.info(`getting pull requests for release: ${release.name}`);

  const tag = release.tag_name;
  core.info(`tag: ${tag}`);

  const previousTag = gitClient.getPreviousTag(tag);
  core.info(`previousTag: ${previousTag}`);

  const commits = gitClient.getCommitsBetweenTags(previousTag, tag);
  core.info(`commits: [${commits.join(',')}]`);

  const promises = commits.map((commitSha) => githubClient.getPullRequestsFromCommit(commitSha));
  const { successes, failures } = await resolveAndReturn(promises);
  const pullRequests: GithubPullRequest[] = successes.flat();

  core.info(`pullRequests: [${pullRequests.map(pr => pr.url).join(',')}]`);
  core.info(`pullRequests errors: ${JSON.stringify(failures)}`);

  // skip pull requests that aren't merged
  // (e.g. if one pull request is linked to close another)
  const mergedPromises = pullRequests.map((pr) => githubClient.isPullRequestMerged(pr.number));
  const mergedResults = await Promise.allSettled(mergedPromises);
  const mergedPullRequests = [];
  for (const [index, mergedResult] of mergedResults.entries()) {
    if (mergedResult.status === 'fulfilled' && mergedResult.value === true) {
      mergedPullRequests.push(pullRequests[index]);
    } else {
      const prNumber = pullRequests[index].number;
      core.info(`pull request #${prNumber} ignored because it was not merged`);
    }
  }

  return mergedPullRequests;
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
  core.info(`getting linked issues for pull request: #${pullRequest.number}`);

  const prBody = pullRequest.body.toLowerCase();
  const issueNumbers: number[] = dedupArray(parseIssueNumbers(prBody));
  core.info(`issue numbers found: [${issueNumbers.map((num) => '#' + num).join(',')}]`);

  const { successes } = await resolveAndReturn(issueNumbers.map((issueNum) => githubClient.getIssue(issueNum)));
  let issues: GithubIssue[] = successes;
  core.info(`validated issues: [${issues.map(issue => '#' + issue.number).join(',')}]`);

  // filter out pull requests
  // (in the GitHub API, all pull requests are issues, but not all issues are pull requests)
  issues = issues.filter((issue) => (!issue.pull_request));
  core.info(`validated issues (PRs filtered out): [${issues.map(issue => '#' + issue.number).join(',')}]`);

  return issues;
}

export async function hasAlreadyCommentedOn(githubClient: GithubClient, issueNumber: number): Promise<boolean> {
  core.info(`checking if github action has already commented on issue #${issueNumber}`);

  const comments = await githubClient.listIssueComments(issueNumber);

  for (const comment of comments) {
    if (isCommentCreatedByAction(comment)) {
      core.info(`comment ${comment.html_url} was created by an action`);
      return true;
    }
  }
  core.info('no comments created by actions found');

  return false;
}

export function isCommentCreatedByAction(comment: GithubIssueComment): boolean {
  return comment.body.includes(GITHUB_RELEASE_NOTIFIER_TAG);
}

export interface CommentOnOptions {
  readonly githubClient: GithubClient;
  readonly pullRequest: GithubPullRequest;
  readonly issues: GithubIssue[];
  readonly release: GithubRelease;
}

export async function commentOn(options: CommentOnOptions): Promise<number> {
  const promises = [];
  const { githubClient, pullRequest, issues, release } = options;

  // The way we currently handle promises could be optimized by chaining the
  // "hasAlreadyCommentedOn" promises with the "addComment" promises so more
  // work can be done in parallel - but for now this works. Some care is
  // needed to parallelize this without making the logs harder to read.

  const prMessage = PR_COMMENT_TEMPLATE(release.name, release.html_url);
  let skipCommenting = await hasAlreadyCommentedOn(githubClient, pullRequest.number);
  if (!skipCommenting) {
    promises.push(githubClient.createComment(pullRequest.number, prMessage));
  }

  for (const issue of issues) {
    const issueMessage = ISSUE_COMMENT_TEMPLATE(pullRequest.number, release.name, release.html_url);
    skipCommenting = await hasAlreadyCommentedOn(githubClient, issue.number);
    if (!skipCommenting) {
      promises.push(githubClient.createComment(issue.number, issueMessage));
    }
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
    const githubClient = new GithubClient(octokit, { owner, repo });
    const gitClient = new GitClient();

    const release = await githubClient.getLatestRelease();
    const pullRequests = await getPullRequests(gitClient, githubClient, release);

    let totalComments = 0;
    for (const pullRequest of pullRequests) {
      const issues = await getLinkedIssues(githubClient, pullRequest);
      totalComments += await commentOn({ githubClient, pullRequest, issues, release });
    }

    core.setOutput('total-comments', totalComments);
  } catch (error) {
    core.setFailed(error.message);
  }
}
