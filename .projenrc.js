const { TypeScriptProject, YamlFile } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');

const ACTION_NAME = 'github-release-notifier';
const ACTION_DESCRIPTION = 'Updates issues and pull requests when relevant code changes are published to GitHub releases.';

const project = new TypeScriptProject({
  name: ACTION_NAME,
  authorName: 'Amazon Web Services',
  authorUrl: 'https://aws.amazon.com',
  description: ACTION_DESCRIPTION,

  defaultReleaseBranch: 'main',

  deps: ['@actions/core', '@actions/github'],
  devDeps: ['@jest/globals', '@vercel/ncc'],

  tsconfig: {
    compilerOptions: {
      lib: ['es2020'],
    },
  },

  compileBeforeTest: true,
});

// package as a single runnable .js file in /dist
project.packageTask.reset('ncc build --source-map --license licenses.txt');
project.package.addField('main', 'lib/main.js');
project.addGitIgnore('!/dist');
project.annotateGenerated('/dist/**');

// provide metadata for GitHub action
// https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions
// TODO: add as projen component?
new YamlFile(project, 'action.yml', {
  obj: {
    name: ACTION_NAME,
    description: ACTION_DESCRIPTION,
    author: 'Amazon Web Services',
    inputs: {
      token: {
        required: false,
        description: 'GitHub token used for making GitHub API calls (defaults to GITHUB_TOKEN)',
        default: '${{ github.token }}',
      },
      mode: {
        required: true,
        description: 'Whether to add reminders for the latest release, or to backfill and add reminders for all releases.',
        default: 'latest',
      },
    },
    outputs: {
      'total-comments': {
        description: 'The total number of comments added.',
      },
    },
    runs: {
      using: 'node12',
      main: 'dist/index.js',
    },
    branding: {
      icon: 'bell',
      color: 'purple',
    },
  },
});

// task to simulate running the action locally
// requires GITHUB_TOKEN to be set in your shell
const devTest = project.addTask('dev');
devTest.spawn(project.packageTask);
devTest.exec('act release -s GITHUB_TOKEN=$GITHUB_TOKEN');

const postRelease = project.github.addWorkflow('post-release');
postRelease.on({
  release: {},
});
postRelease.addJobs({
  reminders: {
    permissions: {
      contents: JobPermission.READ,
      issues: JobPermission.WRITE,
    },
    runsOn: 'ubuntu-latest',
    steps: [
      {
        uses: 'actions/checkout@v2',
      },
      {
        uses: './',
        with: {
          mode: 'latest',
        },
      },
    ],
  },
});

project.synth();