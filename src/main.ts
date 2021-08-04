import * as cp from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { GithubPullRequest, GithubRelease } from './types';

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
  LATEST = 'continuous'
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
    core.debug(`getLatestRelease: ${JSON.stringify(response)}`);

    return response.data;
  }

  async getPullRequestsFromCommit(commitSha: string): Promise<GithubPullRequest> {
    const response = await this.octokit.request(`GET /repos/${this.owner}/${this.repo}/commits/${commitSha}/pulls`);
    core.debug(`getPullRequestsFromCommit: ${JSON.stringify(response)}`);

    return response.data;
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

  getTag(tag: string): string {
    return cp.execSync(`git show-ref -s ${tag}`, { cwd: this.workspace }).toString().trim();
  }

  getPreviousTag(tag: string): string {
    return cp.execSync(`git describe --tags --abbrev=0 ${tag}^`, { cwd: this.workspace }).toString().trim();
  }

  /**
   * Returns a list of commit hashes beginning AFTER fromTag, up to and
   * INCLUDING toTag.
   */
  getCommitsBetweenTags(fromTag: string, toTag: string): string[] {
    return cp.execSync(`git rev-list ${fromTag}..${toTag}`).toString().trim().split('\n');
  }
}

async function getPullRequests(gitClient: GitClient, githubClient: GithubClient, release: GithubRelease): Promise<GithubPullRequest[]> {
  const tag = release.tag_name;
  core.debug(`tag: ${tag}`);

  const previousTag = gitClient.getPreviousTag(tag);
  core.debug(`previousTag: ${previousTag}`);

  const commits = gitClient.getCommitsBetweenTags(previousTag, tag);
  core.debug(`commits: ${commits}`);

  const promises = commits.map((commitSha) => githubClient.getPullRequestsFromCommit(commitSha));
  const promiseResults = (await Promise.allSettled(promises)).flat();
  const pullRequests = [];
  for (const result of promiseResults) {
    if (result.status === 'fulfilled') {
      pullRequests.push(result.value);
    }
  }
  core.debug(`pullRequests: ${pullRequests.map(pr => pr.url)}`);

  return pullRequests;
}

function getLinkedIssues(_pullRequests: GithubPullRequest[]): any[] { // TODO: type properly
  return [];
}

async function run(): Promise<void> {
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

    getLinkedIssues(pullRequests); // TODO

    // const totalComments = await commentOn(pullRequests, issues, release);

    core.info('Success!');
    core.setOutput('total-comments', 0); // TODO
  } catch (error) {
    core.setFailed(error.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();