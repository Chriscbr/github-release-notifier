import * as cp from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { OctokitResponse } from '@octokit/types';
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

function getOptions(): ActionOptions {
  const mode: ActionMode | undefined = (<any>ActionMode)[core.getInput('mode')];
  const maximumComments: number = parseInt(core.getInput('maximum-comments'), 10); // may be NaN
  return {
    mode: mode ?? ActionMode.LATEST,
    maximumComments: maximumComments || 50,
  };
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

  async getLatestRelease(): Promise<OctokitResponse<GithubRelease, number>> {
    return this.octokit.request(`GET /repos/${this.owner}/${this.repo}/releases/latest`);
    // return this.octokit.rest.repos.getLatestRelease({
    //   owner: this.owner,
    //   repo: this.repo,
    // });
  }

  async getPullRequests(commitSha: string): Promise<OctokitResponse<GithubPullRequest, number>> {
    return this.octokit.request(`GET /repos/${this.owner}/${this.repo}/commits/${commitSha}/pulls`);
  }

  // getTag(tag: string) {
  //   // return this.octokit.request(`GET /repos/${this.owner}/${this.repo}/git/refs/tags/${tag}`);
  //   return this.octokit.rest.git.getRef({
  //     owner: this.owner,
  //     repo: this.repo,
  //     ref: `refs/tags/${tag}`,
  //   });
  // }
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
  const previousTag = gitClient.getPreviousTag(tag);
  const commits = gitClient.getCommitsBetweenTags(previousTag, tag);
  console.error(commits);

  const promises = commits.map((commitSha) => githubClient.getPullRequests(commitSha));
  const pullRequestsResults = (await Promise.allSettled(promises)).flat();
  const pullRequests = [];
  for (const result of pullRequestsResults) {
    if (result.status === 'fulfilled') {
      pullRequests.push(result.value.data);
    }
  }
  console.error(pullRequests);
  return pullRequests;
}

function getLinkedIssues(_pullRequests: GithubPullRequest[]): any[] { // TODO: type properly
  return [];
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    const { owner, repo } = github.context.repo;
    core.debug(`owner: ${owner}`);
    core.debug(`repo: ${repo}`);
    core.debug(core.getInput('mode'));
    core.debug(core.getInput('maximum-comments'));
    core.debug(`workspace: ${process.env.GITHUB_WORKSPACE}`);

    const options = getOptions();
    core.debug(`options: ${JSON.stringify(options)}`);

    if (options.mode !== ActionMode.LATEST) {
      throw new Error('Only "latest" mode is currently supported.');
    }

    const octokit = github.getOctokit(token);
    const githubClient = new GithubClient(octokit, owner, repo);
    const gitClient = new GitClient();

    const { data: latestRelease } = await githubClient.getLatestRelease();
    core.debug(`latest release: ${JSON.stringify(latestRelease)}`);
    const pullRequests = await getPullRequests(gitClient, githubClient, latestRelease);
    core.debug('pull requests:' + pullRequests.map((pr) => pr.title).join('\n'));

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