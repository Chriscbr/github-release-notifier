const { TypeScriptProject, YamlFile } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');

const ACTION_NAME = 'release-reminders';
const ACTION_DESCRIPTION = 'Updates issues and pull requests when relevant code changes are published to GitHub releases.';

const project = new TypeScriptProject({
  name: ACTION_NAME,
  description: ACTION_DESCRIPTION,
  defaultReleaseBranch: 'main',

  deps: ['@actions/core'],
  devDeps: ['@jest/globals'],

  compileBeforeTest: true,
});

project.package.addField('main', 'lib/main.js');

// include compiled JavaScript in version control so the action runner
// can directly access it without needing to compile
project.addGitIgnore('!/lib');

const actionYaml = new YamlFile(project, 'action.yml', {
  obj: {
    name: ACTION_NAME,
    description: ACTION_DESCRIPTION,
    author: 'Amazon Web Services',
    inputs: {
      milliseconds: {
        required: true,
        description: 'input description here',
        default: 'default value if applicable',
      },
    },
    runs: {
      using: 'node12',
      main: 'lib/main.js',
    },
  },
});

project.buildWorkflow.addJobs({
  integ: {
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
          milliseconds: 1000,
        },
      },
    ],
  },
});

project.synth();