import * as github from '@actions/github';
import { GithubIssue, GithubPullRequest, GithubRelease } from './types';
export declare enum ActionMode {
    /**
     * Backfills previous pull requests and issues with release reminders
     * for all previous releases as a bulk operation.
     *
     * The operation will finish when the max-backfill-operations limit is
     * reached, or when all releases have been backfilled.
     */
    ALL = "all",
    /**
     * Add release reminders to issues and pull requests for only the
     * latest available release.
     */
    LATEST = "latest"
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
declare type HydratedOctokit = ReturnType<typeof github.getOctokit>;
export declare class GithubClient {
    private readonly octokit;
    private readonly owner;
    private readonly repo;
    constructor(octokit: HydratedOctokit, owner: string, repo: string);
    getLatestRelease(): Promise<GithubRelease>;
    getPullRequestsFromCommit(commitSha: string): Promise<GithubPullRequest[]>;
    getIssue(issueNumber: number): Promise<GithubIssue>;
    addComment(issueNumber: number, body: string): Promise<void>;
}
export declare class GitClient {
    private readonly workspace;
    constructor();
    setupWorkspace(): string;
    getTag(tag: string): string;
    getPreviousTag(tag: string): string;
    /**
     * Returns a list of commit hashes beginning AFTER fromTag, up to and
     * INCLUDING toTag.
     */
    getCommitsBetweenTags(fromTag: string, toTag: string): string[];
}
export {};
