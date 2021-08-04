const { TypeScriptProject, YamlFile } = require('projen');
const { TaskWorkflow } = require('projen/lib/github');
const { JobPermission } = require('projen/lib/github/workflows-model');

const ACTION_NAME = 'release-reminders';
const ACTION_DESCRIPTION = 'Updates issues and pull requests when relevant code changes are published to GitHub releases.';

const project = new TypeScriptProject({
  name: ACTION_NAME,
  description: ACTION_DESCRIPTION,
  defaultReleaseBranch: 'main',

  deps: ['@actions/core', '@actions/github', 'octokit', '@octokit/types'],
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

const actionYaml = new YamlFile(project, 'action.yml', {
  obj: {
    name: ACTION_NAME,
    description: ACTION_DESCRIPTION,
    author: 'Amazon Web Services',
    inputs: {
      token: {
        required: false,
        description: 'input description here', // TODO
        default: '${{ github.token }}',
      },
      mode: {
        required: true,
        description: 'input description here', // TODO
        default: 'continuous', // TODO
      },
    },
    runs: {
      using: 'node12',
      main: 'dist/index.js',
    },
  },
});

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
          mode: 'continuous',
        },
      },
    ],
  },
});

// project.buildWorkflow.addJobs({
//   integ: {
//     permissions: {
//       contents: JobPermission.READ,
//       issues: JobPermission.WRITE,
//     },
//     runsOn: 'ubuntu-latest',
//     steps: [
//       {
//         uses: 'actions/checkout@v2',
//       },
//       {
//         uses: './',
//         with: {
//           mode: 'continuous',
//         },
//       },
//     ],
//   },
// });

project.synth();