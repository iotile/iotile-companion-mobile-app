# IOTile-M

This is a hybrid mobile app using the Ionic Framework.

It is intended to allow customers to interact with their IOTile Devices as well as the
IOTile.cloud Dashboard.

# Getting Started

### First Time Setup
Make sure you have `node` and `npm` installed; then, from the top level directory:

```
npm install -g cordova typescript
npm install
```

### After that,
`source ./env.sh`


# Development

- For local testing in the browser with hot reloading on changes use:

```
npm run watch
```

- To test using the staging server use:

```
npm run watch-stage
```

- To download to an android phone use:

```
npm run android
```

- To download to an iOS phone use:

```
npm run ios
```

- To build for iOS or android use:

```
npm run build-[ios|android]
```

## Testing

- Unit tests are run using `npm test`

## Formatting/Linting

A pre-push hook exists to enforce formatting/linting before code is pushed. If you recieve a `lint` error while pushing code, you must run the lint command below and fix any linting errors before your code can be pushed.

You can check for linting errors with:
```
npm run lint
```

All formatting rules are handled with [prettier](https://prettier.io/).

To auto-fix formatting and (some) linting errors, run:
```
npm run lint-fix
```

## Build Process

* All source files are stored in `app/**/*`.  The source files are processed through the typescript compiler `tsc` using webpack and built into `www/`.  
* Unit tests are located in `test/**/*`.
* Documentation is generated using **ngdoc** and stored in `dist/doc`

## Version Control (Git) Processes

In general, development should follow the [GitHub flow](https://guides.github.com/introduction/flow/) process, which consists of a `master` branch that is always ready for production (even if it is not being deployed), and [`feature`](#feature-branches) branches. In addition we make use of a `release` branch as described below.

### Release Branch
The release branch follows the naming pattern `v<MAJOR>.<MINOR>` (e.g. v4.1). This branch enables [hotfixes](#hotfix) of urgent bugs that are found in the currently deployed version in production. Once a new Minor or Major version is released into production via a [planned release](#release-planning-lifecycle), a corresponding new `release` branch should be created and the previous `release` branch should be deleted.

### Feature Branches
All direct commits will occur within an appropriately named feature branch of the form:

`<prefix>/<issue#>-<branch_name>`

Most branches should fit within one of four major categories/prefixes: [`feature/`](#feature), [`bugfix/`](#bugfix), [`refactor/`](#refactor), or [`hotfix/`](#hotfix). 

#### Pull Requests
As work progesses on a branch, you should frequently rebase your branch onto `master` (or merge `master` into your branch) to make sure you incorporate the latest changes from master. Before being merged into the `master` branch, your branch should be reviewed and approved through a pull request (PR). The final step of the PR should be to sync your branch with `master` (via merge or rebase) and resolve any conflicts. Once all conflicts are resolved, you should merge the PR using GitHub's `Squash and merge` or  `Rebase and merge` options. We disallow merge commits in order to keep a more linear commit history for easier rollbacks.

#### Issues
Most branches should tie directly to a corresponding GitHub issue, whether it is a bug report or a feature request. If an issue does not exist, you should create one before creating your branch. This issue will provide a centralized location for all notes/comments related to development within the branch. Once the branch is merged via an approved PR, this issue should be closed.

#### Branch Names
The `branch_name` should be a short but clarifying description of the branch's purpose. Including the issue # before the `branch_name` will provide an easy reference to the issue/feature request the branch is meant to resolve. Some example branches could be:

- `feature/1109-upload-button`
- `bugfix/34-UI-crash-on-login`
- `refactor/98-modularize-cloud-tools`

The following provides a brief description of the four main branch categories/prefixes:

##### `feature/`
A branch should be labelled as a feature if it's purpose is to add functionality to the project.

##### `bugfix/`
A bugfix should focus on fixing bugs in the project.

##### `refactor/`
Changes labeled as a refactor should ideally not affect the functionality or UI of the project and should focus on improving the structure to maximize developer productivity.

##### `hotfix/`
If an urgent bug is discovered in the currently deployed production version, a `hotfix/` branch should be branched off of the relevant [`release`](#release-branch) branch. Once the bug is fixed, the `hotfix/` branch should be merged back into the [`release`](#release-branch) branch, the patch version should be updated (e.g. from v4.1.0 -> v4.1.1), tagged, and deployed to production. If possible the `hotfix/` branch should also be merged back into `master`, or if merging is not reasonable, a new `bugfix/` branch should be created to fix the bug for the next [planned release](#release-planning-lifecycle).

### Archived Branches
If a branch contains valuable changes but is incomplete and has been postponed due to a shift in priorities, that branch should be archived to avoid cluttering the Version Control/Git tree. Archiving a branch involves tagging it with an `archive/<branch_name>` tag and deleting the branch, as described in [this SO post](https://stackoverflow.com/questions/1307114/how-can-i-archive-git-branches). The branch can be restored from the tag whenever development on the branch is resumed.

## Release Planning Lifecycle
We make use of [GitHub projects](https://github.com/iotile/iotile-mobile-ionic/projects) to plan for and organize future releases. For a planned release, a new GitHub project will be created named `v<MAJOR>.<MINOR>` (e.g. v4.2). Any new features and low priority bug fixes planned for the next release should be added (as issues) to this project. When the project is finished (either all the tasks in the project are complete, or the release date is approaching), the `master` branch should be tagged with the corresponding version (e.g. v4.2.0), the next [`release`](#release-branch) should be created (e.g. `v4.2`), and the previous `release` branch should be deleted. Once the latest release has been deployed to production, the cycle starts again with a new GitHub project. If there are any feature branches that were not merged with the release, they should either be moved to the next release project, or [archived](#archived-branches).

## Release Process
As development on a release progresses, there may be a need for some updates to be tested. This can be accomplished by deploying the master branch to Testflight and [Google Play Alpha](https://play.google.com/apps/publish/?account=8115281178836537702#ManageReleaseTrackPlace:p=com.archiot.iotileapp&appid=4975350606631655023&releaseTrackId=4698501673875893759). See [this presentation](https://docs.google.com/presentation/d/1x1AuMLXcQopI8scoHEnXzWwR8PUFsBr5npCe38EpMkQ/edit#slide=id.p1) on how to deploy.

When all the planned updates for the next release are complete, you should manually [update the version](#updating-the-version) and deploy one last time for final testing.  Once testing is complete and any needed adjustments have been pushed, the Testflight and Google Play Alpha should be [deployed/upgraded to production](https://docs.google.com/presentation/d/1x1AuMLXcQopI8scoHEnXzWwR8PUFsBr5npCe38EpMkQ/edit#slide=id.g4d8963ce81_0_66) to finalize the release.

## Versioning

This project loosely follows the [Semantic Versioning](https://semver.org/) rules and format of `MAJOR.MINOR.PATCH`.

### Major Version
A major version should be a clear distinction and will correspond with either a large refactor or a major feature.

### Minor Version
A minor version should correspond with feature or UI updates that will be clearly visible to the user, or with a sizeable refactor.

### Patch Version
A patch version should correspond to a [`hotfix/`](#hotfix) branch that fixes an urgent bug in the currently deployed production version (i.e. the current [`release`](#release-branch) branch).

### Updating the Version

The app's version information is used in multiple places but these are all automatically synced (with the exception of `package.json`) from one master source: `config.xml`.  You need to update the `version` tag inside `config.xml`. You should also update the version in `package.json`.

- `config.xml` is the key file to change as it drives Cordova. `version` represents the version number the user will see in the stores. This version number is synced to the version reported to Sentry for collecting errors, the version shown the App and Play Stores and the version shown in the app automatically.

**NOTE:** `android-versionCode` and `ios-CFBundleVersion` are the build numbers used by the different stores to ID the artifacts we are uploading. Even if the version number does not change (in the event we are fixing something before release), the build numbers should ALWAYS change, or the stores will reject the upload. **These build numbers are automatically updated using a cordova hook
script.  No special action is required to update build numbers.**

# Original Template

This project was originally generated with Generator-M-Ionic v1.9.2.
Original generator-ionic-m template is released under the MIT license.
