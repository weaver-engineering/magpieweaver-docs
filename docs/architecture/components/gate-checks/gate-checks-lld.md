# High Level Design - Collaboration & Merge System

## Context

- [Glossary](../../../glossary.md) - Glossary of terms.
- [About Magpie Weaver](../../../magpie-weaver.md) - Background reading about Magpie Weaver.
- [High Level Design](../../high-level-design.md) - Magpie Weaver high level design.
- [Architecture Definition](../../architecture-definition-document.md) - Magpie Weaver Architecture.

## 1. System Details

### 1.1 Overview
The set of checks to be run on the CI/CD pipeline.
The checks are a pnpm function `gate-check` which receives the check to run as its first parameter.
It returns 0 if the check passed.
It returns 1 if the check failed.
It returns 2 if the given arguments are not valid.
The first parameter `check-name` is required.
It can optionally output ONLY a JSON document to stdout by specifying the `--json` flag
If the `--json` flag is not given then the logging output of the check is written to stdout.
Arguemnts can be passed to the check from the command line, arguemnts are named `--<arg-name>`.
Argument values follow thier argument name.
Multiple values for a single arguemnt name are interpreted as `string[]`.
Arguement names without values are intepreted as a `boolean true`, so `--isSet` is equivalent to `--isSet true`
Numerical argument values are interpreted as `number` unless there are many when they are interpreted as `string[]`

* Usage `pnpm gate-check <check-name> [--json, --<arg-name> <arg-value>, --list-arg-name <value[0]> <value[1]> <value[2]> ... ]`
* `<check-name>` is always the first arg
* other args can appear in any order

### 1.2 Component Layout

* `packages/gate-checks`       
  * `cli.ts`                  # argument parsing and dispatch only
  * `types.ts`                # shared types
  * `git-interface.ts`        # `GitInspector` interface to abstract the call to `simpleGit` from the check logic for testing.
  * `git-inspector.ts`        # implementation of `GitInspector` using `simpleGit`
  * `coverage-interface.ts`   # `ConverageInspector` interface to abstract the call to pnpm 
  * `coverage-inspector.ts`   # implementation of `CoverageInspector` using pnpm and reading from `coverage`
  * `checks`
    * `index.ts`              # registry mapping name -> check function
    * `pr-and-branch-refs.ts` # individual function components
    * `pr-title`              # each function may receive params from command line
    * `get-inbound-commits`   # each function async and returns a `Promise<GateCheckResult>`
    * `validate-spec-commit`  # or not async and returns a `GateCheckResult`
    * `validate-test-commit`
    * `validate-build-commit`
    * `validate-task-commit`
    * `existing-tests-pass`
    * `new-tests-fail`
    * `coverage`
    * `spec-gate`


## 2. Interfaces
```typescript
/**
 * The standardised output of all gate checks
 */
export interface GateCheckResult {
  /**
   * The name of the check
   */
  check: string,
  /**
   * The arguments passed to the check
   */
  args: Record<string, boolean | number | string | string[]>
  /**
   * Whether the check passed or not
   */
  passed: boolean,
  /**
   * Information messages provided by the check
   */
  messages: string[],
  /**
   * Violation messages provided by the check
   */
  violations: string[],
  /**
   * a brief summary of the status of the check
   */
  summary: string
  /**
   * Values exported by the check to be passed to other checks
   */
  values: Record<string, boolean | number | string | string[]>
}

/**
 * The defintion of a check function and its required arguemnts
 * Contained in the FunctionCatalog
 */
export interface FunctionDef {
  /**
   * The gate-check function
   */
  fn: GateCheckFn,
  /**
   * The list of required arguments for the function
   */
  requiredArgs: [string]
}

/**
 * The signature of all gate-check functions
 */
export type GateCheckFn = (inspectors: Inspectors, args: Record<string, boolean | number | string>) => Promise<GateCheckResult> | GateCheckResult;

/**
 * The function catalog linking functions and thier required arguments to names
 */
export type FunctionCatalog = Record<string, GateCheckFn>

/**
 * A shallow interface to the git command line for the access required
 * to validate commits conforming to the ways of working.
 * 
 * Required to mock git access in unit tests
 */
export interface GitInspector {
  /**
   * Get the reference (Sha) of the commit where the 2 references diverge
   * @param aRef The reference to a commit
   * @param bRef The reference to another commit
   * @returns   The commit reference where the chenges to aRef diverge from the changes to bRef 
   */
    mergeBase(aRef: string, bRef: string): Promise<string>;
  /**
   * List the file changes between baseSha and headSha
   * If headSha is not given then list the file changes in baseSha
   * returns a list of the changed paths in the repository
   * 
   * @param baseRef The starting reference
   * @param headRef The ending reference
   * @returns   a list of the changed paths in the repository between baseRef
   *            and headRef
   */
    diffTree(baseRef: string, headRef?: string): Promise<string[]>;

  /**
   * List the paths in the repository at the given commit reference
   * If the path is not given list all the paths in the repository
   * @param commitRef List the paths in the repository upto this reference
   * @param path If given only list the paths with this prefix.
   * @returns   A list of the paths in the repository to the given reference
   */
    lsTree(commitRef: string, path?: string): Promise<string[]>;

  /**
   * List the commit messages from baseRef to headRef
   * If headRef is not given then return the commit message for the baseRef
   * @param baseRef The reference of the first commit message
   * @param headRef The reference of the last commit message
   * @returns   The commit messages between baseRef and headRef
   */
    commitMessages(baseRef: string, headRef?: string): Promise<string[]>

  /**
   * List the files added between baseRef and headRef
   * If headRef is not given list the files added by baseRef
   * If the path is given only list the files added with that prefix
   * @param baseRef The starting reference
   * @param path The path prefix
   * @param headRef The ending reference
   * @Returns   The files added to the repository between baseRef and headRef
   */
    added(baseRef: string, path?: string, headRef?: string): Promise<string[]>

  /**
   * List the files modified between baseRef and headRef
   * If headRef is not given list the files modified by baseRef
   * If the path is given only list the files modified with that prefix
   * @param baseRef The starting reference
   * @param path The path prefix
   * @param headRef The ending reference
   * @Returns   The files modified in the repository between baseRef and headRef
   */
    modified(baseRef: string, path?: string, headRef?: string): Promise<string[]>

  /**
   * List the files deleted between baseRef and headRef
   * If headRef is not given list the files deleted by baseRef
   * If the path is given only list the files deleted with that prefix
   * @param baseRef The starting reference
   * @param path The path prefix
   * @param headRef The ending reference
   * @Returns   The files added to the repository between baseRef and headRef
   */
    deleted(baseRef: string, path?: string, headRef?: string): Promise<string[]>

  /**
   * List the commits from baseRef to headRef
   * @param baseRef The starting reference
   * @param headRef The ending refernce
   * @returns   The commit reference between the base reference and the head reference
   */
    revList(baseSha: string, headSha: string): Promise<string[]>
}

/**
 * A shallow interface to the package manager for running tests and collecting coverage
 */
export interface CoverageInspector {
  /**
   * Run the tests and collect coverage
   * If the path is given only run tests at that path
   * @param path If given only run the tests at the path
   */
  runTestsWithCoverage(path?: string): void;

  /**
   * Inspect the coverage and return the percentage new line coverage
   * @param path If given return the coverage at the path
   * @returns The percentage new line coverage
   */
  getNewLineCoverage(path?: string): Promise<number>;

  /**
   * Inspect the coverage and return the percentageline coverage
   * @param path If given return the coverage at the path
   * @returns The percentage line coverage
   */
  getCoverage(path?: string): Promise<number>;
}

/**
 * The inspectors to be passed to each function call
 */
export interface Inspectors {
  /**
   * The git inspector instance for the function to use if it needs it
   */
  git: GitInspector;

  /**
   * The coverage inspector for the function to use if it needs it
   */
  coverage: CoverageInspector;
}
```

## 3. Design Notes
* Wherever the design mentions `{ref}` the `{ref}` must conform to regex `[A-Z]+-[0-9]+` 
* When a function 'exposes' values they are included in the `GateCheckResult.values` map.
* specification files names match regex `^task-[A-Z]+-[0-9]+(-[0-9]+)?(-[a-z])?-spec\.md$`
* All functions receive an instance of `Inspectors` as the first argument to facilitate testing.
* Functions record their arguments in `GateCheckResult.args`
* Functions log messages to `GateCheckResult.messages`
* Functions log violations to `GateCheckResult.vilolations`
* Functions log their check state passed: true -> passed, false -> failed
* The functions may only use the `GitInspector` for git operations
* The functions may only use the `CoverageInspector` for coverage operations 
* Unit testing via mocking `GitInspector` and `CoverageInspector`
* `GitInspector` & `CoverageInspector` implementations not covered by unit test.
* CLI usage `pnpm gate-check <check-name> [--json, --<arg-name> <arg-value>, --list-arg-name <value[0]> <value[1]> <value[2]> ... ]`
* `<check-name>` is always the first arg
* other args can appear in any order


## 4. Component Details

### 4.1 cli.ts
* The CLI entry point
* Gets the <check-name> and any args from the command line
* Uses the command registry `index.ts` to get the function by name from the function catalog.
* writes a failed `GateCheckResult` to stdout if invalid arguments with return val 2 (invalid arguments, no <check-name> not given, check not found, required args missing)
* Calls the function with the inspectors and given arguments
* if `--json` flag is given in args

### 4.2 types.ts
* Defines all the common types used by `gate-checks`

### 4.3 index.ts
* imports function and requiredArgs from each function script.
* Assembles them into `catalog: FunctionCatalog` keyed on function name e.g. "pr-title"
* Exports the function catalog.


### 4.4 pr-and-branch-refs.ts
* requires args
  * `--head-ref`: string
  * `--pr-base-ref`: string
* validates
  * `head-ref` matches `*/{ref}`
  * `pr-base-ref` matches `build/{ref}`
  * `{ref}` matches `[A-Z]+-[0-9]+`
* exposes
  * ref: string =`${ref}`

### 4.5 pr-title
* requires args
  * `--ref`: string
* validates
  * `{ref}` matches `[A-Z]+-[0-9]+`
  * PR title contains `{ref}`
* exposes
  * pr-title: string =`${prTitle}`

### 4.6 get-inbound-commits
* requires args
  * `--pr-base-sha`: string
  * `--pr-head-sha`: string
* validates
  * commits present (fails if pr-head-sha == pr-base-sha)
* exposes
  * commits: string[] = [pr-base-shs -> pr-head-sha]


### 4.7 validate-spec-commit
* requires args
  * `--spec-commit-sha`: string
* validates
  * commit message title starts with `{ref}`
  * commit message title continues beyond `{ref}`
  * commit message body is not empty
  * `docs/tasks/task-{ref}` exists and is a directory
  * changes only exist in `docs/tasks/task-{ref}`
  * `docs/tasks/task-{ref}/task-{ref}.md` exists and is a file
  * At least 1 specification file exists in `docs/tasks/task-{ref}` matching `^task-[A-Z]+-[0-9]+(-[0-9]+)?(-[a-z])?-spec\.md$`
* exposes
  * task: string = `docs/tasks/task-{ref}/task-{ref}.md`
  * specs: string[] = [`docs/tasks/task-{ref}/task-{ref}-spec.md`, ...]

### 4.8 validate-test-commit
* required args
  * `--test-commit-sha`: string
* validates
  * commit message title starts with `{ref}`
  * commit message title continues beyond `{ref}`
  * commit message body is not empty
  * commit only changes files in `test` directory or to `package.json`, `pnpm-lock.yaml`
  * commit does not change existing tests
  * commit defines a new test in `test` directory
* exposes
  * existingTests: string[] = [path-to-test.ts, ...]
  * newTests: string[] = [path-to-test.ts, ...]


### 4.9 validate-build-commit
* required args
  * `--build-commit-sha`: string
* validates
  * commit message title starts with `{ref}`
  * commit message title continues beyond `{ref}`
  * commit message body is not empty
  * commit only changes files in `apps` or `packages` directory or to `package.json`, `pnpm-lock.yaml`
* exposes
  * newFiles: string[] = [path-to-new.ts, ...]
  * modifiedFiles: string[] = [path-to-modified.ts, ...]
  * deletedFiles: string[] = [path-to-deleted.ts, ...]


### 4.10 validate-task-commit
* required args
  * `--task-commit-sha`: string
* validates
  * commit message title starts with `{ref}`
  * commit message title continues beyond `{ref}`
  * commit message body is not empty
* exposes
  * newFiles: string[] = [path-to-new.ts, ...]
  * modifiedFiles: string[] = [path-to-modified.ts, ...]
  * deletedFiles: string[] = [path-to-deleted.ts, ...]
  * newTests: string[] = [path-to-new.test.ts, ...]
  * modifiedTests: string[] = [path-to-modified.test.ts, ...]
  * deletedTests: string[] = [path-to-deleted.test.ts, ...]


### 4.11 existing-tests-pass
* validates
  * all existing tests pass (requires coverage to have been run)
* exposes
  * numTests: number = total number of tests
  * numTestFailures: number = total number of test failures
  * failingTests: string[] = [path-to-failing-test.ts, ...]


### 4.12 new-tests-fail
* validates
  * at least 1 new test fails (requires coverage to have been run)
* exposes
  * numTests: number = total number of new tests
  * numTestFailures: number = total number of new test failures
  * newTests: string[] = [path-to-new-test.ts, ...]
  * newTestFailures: string[] = [path-to-failed-new-test.ts, ...]


### 4.13 coverage
* required args
  * `--expect-failure`: boolean (if true pass on failing tests else fail on failing tests)
* validates
  * new line coverage > 90%
  * line coverage > 80%
* exposes
  * lineCoverage: number (percentage line coverage)
  * newLineConverage: number (percentage new line coverage)


### 4.14 spec-gate
* required-args
  * None
* optional-args
  * `--destination-branch`: string (the destination branch to which a PR would be raised for these changes. default to "main" if not given. )
* validates
  * 1 commit between HEAD and mergeBase for the destination branch
  * HEAD of the destination branch is at the mergeBase between HEAD and the destination branch 
  * the commit using validate-spec-commit