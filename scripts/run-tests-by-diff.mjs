#!/usr/bin/env node
// Complete comparison + syntax proof + Vitest's existing consumer discovery.
// Agents judge meaning and add relevant proof; declarations can never subtract checks.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const isTest = (file) => /\.(?:test|node-test)\.[cm]?[jt]sx?$/.test(file);
const isDoc = (file) => /\.(?:md|mdc)$/.test(file);
const isPolicy = (file) =>
  /^(?:AGENTS\.md|CLAUDE\.md|\.github\/|\.cursor\/rules\/|\.husky\/|docs\/(?:standards|agent-guides)\/|scripts\/(?:run-tests-by-diff\.mjs|review\/|ci\/|docs\/checkWorkspaceGuardrails\.mjs)|tests\/(?:runTestsByDiff\.test\.ts|tooling\/phase3aWorkflow\.node-test\.ts))/.test(
    file
  );
const isGlobal = (file) =>
  /^(?:package(?:-lock)?\.json|(?:vite|vitest).*\.config\.[jt]s|tsconfig(?:\.node)?\.json|tests\/(?:setup|helpers\/|__mocks__\/))/.test(
    file
  );
// Minimum review obligations for executable responsibility changes, not suite
// mappings. Presentation proof is checked first. Financial logic lives across
// salary, cap, contract, trade and governed-lifecycle code and source tables,
// including server/cloud code. Actual consequences can require review beyond
// these responsibility signals; no signal requests a full-project suite.
const isSensitive = (file) => {
  const financialLogic =
    /salary|salaries|cap|apron|contract|trade|legality|waiver|extension|exception|signing|offerSheet|rfa|rights|stepien|entitlement|governed|cba|rulesProfile|tpe|deadMoney|invariant|penalty|rookie|draft[-_]?pick|draft[-_]?review|transaction|offseason|commit|manifest|fence|ledger|evidence|certified/i.test(
      file
    );
  return (
    financialLogic ||
    /^(?:functions\/|server\/|api\/)/.test(file) ||
    /^tsconfig\..*\.json$/.test(file) ||
    /(?:mutationPipeline|seasonManager|firebase|firestore|persist|world.*(?:Service|Store|Manager)|auth|src\/schemas\/|source-releases|scripts\/(?:dev|release|admin)\/|player-scrape|team-scrape)/i.test(
      file
    )
  );
};
// A direct import guard reuses the parser already used for presentation proof.
// It does not build a dependency graph or execute candidate modules. Keep both
// sides: removing a protected dependency can remove a safeguard too.
function usesSensitiveRuntimeDependency(file, contents = {}) {
  return [contents.before, contents.after].filter(Boolean).some((text) => {
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true
    );
    return source.statements.some((statement) => {
      if (
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement)
      )
        return false;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly)
        return false;
      const clause = statement.importClause;
      if (
        clause &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length &&
        clause.namedBindings.elements.every((item) => item.isTypeOnly)
      )
        return false;
      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length &&
        statement.exportClause.elements.every((item) => item.isTypeOnly)
      )
        return false;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) return false;
      const module = specifier.text.startsWith('.')
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(file), specifier.text)
          )
        : specifier.text.replace(/^@\//, 'src/');
      return isSensitive(module) || isPolicy(module);
    });
  });
}
const sourceFile = (file) => !isDoc(file) && !isTest(file);

// Deliberately syntactic, not an attempted semantic/financial classifier.
// Preserve conditions, handlers, ARIA, hidden/display, imports and calculations.
// Only palette/spacing literals and ordinary JSX text can differ. The agent must
// inspect meaning, contrast, shared styles and consumers before calling it cosmetic.
export function presentationOnly(file, before, after) {
  if (!/\.[jt]sx$/.test(file) || !before || !after || before === after)
    return false;
  const normalize = (text) => {
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    if (source.parseDiagnostics.length) return null;
    const edits = [];
    const visit = (node) => {
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(source) === 'className' &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        const value = node.initializer.text
          .split(/\s+/)
          .map((token) => {
            // Keep variants (hover/disabled/etc.) and property identity intact.
            const color =
              /^(.*:)?(bg|text|border|border-[trblxy]|fill|stroke)-(?:red|blue|green|yellow|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|[1-9]00|950)(\/\d+)?$/;
            if (color.test(token))
              return token.replace(color, '$1$2-PALETTE$3');
            return token.replace(
              /^((?:.*:)?(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?))-\d+(?:\.\d+)?$/,
              '$1-SPACING'
            );
          })
          .join(' ');
        edits.push([
          node.initializer.getStart(source),
          node.initializer.end,
          JSON.stringify(value),
        ]);
      } else if (ts.isJsxText(node) && node.text.trim()) {
        // Status/error/disclosure copy is not an automatic content shortcut.
        if (
          !/error|fail|warn|block|success|approv|declin|denied|legal|guarantee|save|persist|delete|unauthor|unavailable/i.test(
            node.text
          )
        )
          edits.push([node.getFullStart(), node.end, 'DISPLAY_TEXT']);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const [start, end, replacement] of edits.reverse())
      text = text.slice(0, start) + replacement + text.slice(end);
    return text;
  };
  const left = normalize(before),
    right = normalize(after);
  return left !== null && right !== null && left === right;
}

export function readDeclarations(messages = '') {
  const tests = new Set();
  let review = false;
  const broadReasons = [];
  for (const line of messages.split(/\r?\n/)) {
    if (line.startsWith('Validation-Tests: ')) {
      const values = JSON.parse(line.slice(18));
      if (
        !Array.isArray(values) ||
        values.some(
          (file) =>
            typeof file !== 'string' ||
            !isTest(file) ||
            file.includes('..') ||
            path.isAbsolute(file)
        )
      )
        throw new Error('Validation-Tests must name repository test files');
      values.forEach((file) => tests.add(file));
    }
    if (line === 'Validation-Review: required') review = true;
    if (line.startsWith('Validation-Full: ')) {
      const reason = line.slice(17).trim();
      if (reason.length < 20)
        throw new Error('Full validation needs a concrete broad-risk reason');
      broadReasons.push(reason);
    }
  }
  return { tests: [...tests], review, broadReasons };
}
export function gitEnvironment(environment = process.env) {
  const redirects = new Set([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_NAMESPACE',
  ]);
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !redirects.has(key))
  );
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    env: gitEnvironment(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// --no-renames intentionally retains both the deleted and added path. NUL
// parsing preserves spaces/newlines; the whole merge-base range covers all commits.
export function collectChanges({
  cwd = process.cwd(),
  base,
  head = 'HEAD',
  ci = false,
} = {}) {
  const entries = new Map();
  const addDiff = (args) => {
    const parts = git(cwd, [
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      ...args,
      '--',
    ]).split('\0');
    for (let index = 0; index + 1 < parts.length; index += 2) {
      const status = parts[index];
      const file = parts[index + 1];
      if (!status || !file || !/^[AMDTUXB]$/.test(status))
        throw new Error('Unrecognized git diff status');
      // Keep any deletion/type change even when another local layer modifies it.
      entries.set(
        file,
        entries.get(file) === 'D' || entries.get(file) === 'T'
          ? entries.get(file)
          : status
      );
    }
  };
  try {
    if (
      ci &&
      (!/^[a-f0-9]{40}$/.test(base ?? '') || !/^[a-f0-9]{40}$/.test(head))
    ) {
      throw new Error(
        'CI requires explicit base and checked-out candidate SHAs'
      );
    }
    if (!base) {
      base = ['origin/main', 'main'].find((ref) => {
        try {
          git(cwd, ['rev-parse', '--verify', ref]);
          return true;
        } catch {
          return false;
        }
      });
      if (!base) throw new Error('No comparison history');
    }
    const mergeBase = git(cwd, ['merge-base', base, head]).trim();
    addDiff([mergeBase, head]);
    if (!ci) {
      addDiff(['--cached']);
      addDiff([]);
      for (const file of git(cwd, [
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
      ])
        .split('\0')
        .filter(Boolean)) {
        entries.set(file, 'A');
      }
    } else if (git(cwd, ['rev-parse', 'HEAD']).trim() !== head) {
      throw new Error('Checked-out candidate differs from declared CI head');
    }
    const baseFiles = new Set(
      git(cwd, ['ls-tree', '-r', '--name-only', '-z', mergeBase]).split('\0')
    );
    const headFiles = ci
      ? new Set(
          git(cwd, ['ls-tree', '-r', '--name-only', '-z', head]).split('\0')
        )
      : null;
    return {
      contents: Object.fromEntries(
        [...entries.keys()]
          .filter((file) => /\.(?:[cm]?[jt]sx?|css)$/.test(file))
          .map((file) => {
            let before = '',
              after = '';
            if (baseFiles.has(file))
              before = git(cwd, ['show', `${mergeBase}:${file}`]);
            if (ci ? headFiles.has(file) : existsSync(path.join(cwd, file)))
              after = ci
                ? git(cwd, ['show', `${head}:${file}`])
                : readFileSync(path.join(cwd, file), 'utf8');
            return [file, { before, after }];
          })
      ),
      declarations: readDeclarations(
        git(cwd, ['log', '--format=%B%x00', `${mergeBase}..${head}`])
      ),
      files: [...entries.keys()].sort(),
      structural: [...entries.values()].some(
        (status) => !['A', 'M'].includes(status)
      ),
      uncertain: false,
      base: mergeBase,
      head,
    };
  } catch (error) {
    return {
      files: [...entries.keys()].sort(),
      uncertain: true,
      structural: true,
      reason: error.message,
      base,
      head,
    };
  }
}

export function selectValidationProfile(files, options = {}) {
  if (options.uncertain || !files.length)
    throw new Error(
      `Cannot establish complete change coverage: ${options.reason ?? 'empty comparison'}`
    );
  const declarations = options.declarations ?? {
    tests: [],
    review: false,
    broadReasons: [],
  };
  const sources = files.filter(sourceFile);
  const presentation = sources.filter(
    (file) =>
      options.contents?.[file] &&
      presentationOnly(
        file,
        options.contents[file].before,
        options.contents[file].after
      )
  );
  const behavior = sources.filter((file) => !presentation.includes(file));
  const policy = files.some(isPolicy);
  const broadReasons = [
    ...declarations.broadReasons,
    ...files
      .filter(isGlobal)
      .map((file) => `Shared build/test environment changed: ${file}`),
  ];
  const consequential =
    policy ||
    options.structural === true ||
    behavior.some(
      (file) =>
        isSensitive(file) ||
        usesSensitiveRuntimeDependency(file, options.contents?.[file])
    ) ||
    declarations.review ||
    broadReasons.length > 0;
  return {
    level: consequential
      ? 'consequential'
      : behavior.length
        ? 'ordinary'
        : 'cosmetic',
    review: consequential ? 'required' : 'agent-decides',
    reason: consequential
      ? 'Material executable/authority change: independent review and relevant proof'
      : behavior.length
        ? 'Relevant changed behavior and its consumers'
        : 'Presentation/content syntax only: agent must verify meaning, accessibility and affected consumers',
    presentation,
    behavior,
    policy,
    broadReasons,
    // A build validates and delivers actual UI changes, regardless of feature.
    build: sources.some((file) => /^src\//.test(file)) || files.some(isGlobal),
    typecheck:
      behavior.some((file) => /^(?:src|server|api)\/.*\.tsx?$/.test(file)) ||
      files.some(isGlobal),
    structure: options.structural === true,
    docs: files.some(isDoc),
    declarations,
  };
}

// Use Vitest's own Vite import graph, including native and emulator test entries.
// No candidate test is executed during discovery. String/file-read dependencies
// are not inferred: agents retain them using additive Validation-Tests trailers.
export async function discoverTests(files, { cwd = process.cwd() } = {}) {
  const { createVitest } = await import('vitest/node');
  const selected = {
    node: [],
    ui: [],
    native: [],
    emulator: [],
    functions: [],
  };
  const configs = {
    node: 'vitest.node.config.js',
    ui: 'vitest.ui.config.js',
    native: 'vitest.node.config.js',
    emulator: 'vitest.emulator.config.js',
    functions: 'vitest.config.js',
  };
  for (const [kind, config] of Object.entries(configs)) {
    const functionsEnvironment = files.some(
      (file) =>
        /^functions\/(?:package(?:-lock)?\.json|tsconfig\.json)$/.test(file) ||
        file === 'scripts/buildCertifiedSeason.mjs' ||
        isGlobal(file)
    );
    const ctx = await createVitest('test', {
      root: kind === 'functions' ? path.join(cwd, 'functions') : cwd,
      config: path.join(cwd, config),
      watch: false,
      related:
        kind === 'functions' && functionsEnvironment
          ? undefined
          : files.map((file) => path.resolve(cwd, file)),
      ...(kind === 'native'
        ? { include: ['tests/**/*.node-test.{ts,js}'], setupFiles: [] }
        : {}),
    });
    try {
      const specs = await ctx.filterTestsBySource(await ctx.globTestFiles());
      selected[kind] = specs
        .map(([, file]) => path.relative(cwd, file).split(path.sep).join('/'))
        .sort();
    } finally {
      await ctx.close();
    }
  }
  return selected;
}

export function documentationCommands(files) {
  const markdown = files.filter(
    (file) =>
      file.endsWith('.md') &&
      existsSync(file) &&
      (file.startsWith('docs/') || !file.includes('/')) &&
      !file.startsWith('docs/return-packages/') &&
      path.basename(file) !== 'copilot-instructions.md'
  );
  return [
    ...(markdown.length
      ? [
          {
            executable: process.execPath,
            args: [
              'node_modules/markdownlint-cli/markdownlint.js',
              ...markdown,
            ],
          },
        ]
      : []),
    ...(files.some(isPolicy)
      ? [{ script: 'docs:guardrails', fileArgs: [] }]
      : []),
  ];
}

export async function selectTestPlan(files, options = {}) {
  const profile = selectValidationProfile(files, options);
  const inputs = [
    ...new Set([
      ...profile.behavior,
      ...files.filter(isTest),
      ...profile.declarations.tests,
    ]),
  ];
  for (const file of profile.declarations.tests)
    if (!existsSync(path.resolve(options.cwd ?? process.cwd(), file)))
      throw new Error(`Declared test is missing: ${file}`);
  const selected = inputs.length
    ? await (options.discover ?? discoverTests)(inputs, options)
    : { node: [], ui: [], native: [], emulator: [] };
  if (profile.policy) {
    selected.node.push('tests/runTestsByDiff.test.ts');
    selected.native.push('tests/tooling/phase3aWorkflow.node-test.ts');
  }
  for (const kind of Object.keys(selected))
    selected[kind] = [...new Set(selected[kind])].sort();
  const discovered = new Set(Object.values(selected).flat());
  for (const file of [...files.filter(isTest), ...profile.declarations.tests]) {
    if (
      existsSync(path.resolve(options.cwd ?? process.cwd(), file)) &&
      !discovered.has(file)
    )
      throw new Error(
        `Changed/declared test not covered by a configured runner: ${file}`
      );
  }
  const commands = [
    {
      executable: 'git',
      args: ['diff', '--check', ...(options.base ? [options.base] : [])],
    },
  ];
  if (profile.docs || profile.policy)
    commands.push(...documentationCommands(files));
  if (selected.native.includes('tests/tooling/phase3aWorkflow.node-test.ts'))
    commands.push({
      executable: 'git',
      args: [
        'fetch',
        '--no-tags',
        'origin',
        'architect/cba-canon-v2:refs/remotes/origin/architect/cba-canon-v2',
      ],
    });
  if (profile.typecheck) commands.push({ script: 'typecheck' });
  const functionsBuild = profile.behavior.some(
    (file) =>
      file.startsWith('functions/') ||
      file === 'scripts/buildCertifiedSeason.mjs'
  );
  if (functionsBuild || selected.functions?.length) {
    commands.push({
      executable: 'npm',
      args: [
        '--prefix',
        'functions',
        'ci',
        '--include=dev',
        '--no-audit',
        '--no-fund',
      ],
    });
    if (functionsBuild)
      commands.push({
        executable: 'npm',
        args: ['--prefix', 'functions', 'run', 'build'],
      });
    if (selected.functions?.length)
      commands.push({
        executable: process.execPath,
        args: [
          'node_modules/vitest/vitest.mjs',
          'run',
          '--root',
          'functions',
          '--config',
          '../vitest.config.js',
          '--reporter=dot',
          ...selected.functions.map((file) =>
            path.posix.relative('functions', file)
          ),
        ],
      });
  }
  if (
    profile.behavior.some((file) => /^scripts\/dev\/.*\.tsx?$/.test(file)) ||
    files.includes('tsconfig.cloud.json')
  )
    commands.push({ script: 'cloud:typecheck' });
  if (profile.behavior.some((file) => file.startsWith('src/schemas/')))
    commands.push({ script: 'schema:check' });
  if (
    profile.behavior.some((file) =>
      /^src\/features\/architect\/.*\.tsx?$/.test(file)
    )
  )
    commands.push({ script: 'lint:architect-gate' });
  if (profile.broadReasons.length) commands.push({ script: 'test:full' });
  else
    for (const kind of ['node', 'ui'])
      if (selected[kind].length)
        commands.push({ script: `test:${kind}`, fileArgs: selected[kind] });
  if (
    selected.native.some((file) =>
      /hostedDraftReviewBrowser\.node-test/.test(file)
    )
  )
    commands.push({
      executable: 'npx',
      args: [
        '--no-install',
        'playwright',
        'install',
        '--with-deps',
        'chromium',
      ],
    });
  if (selected.native.length)
    commands.push({
      executable: process.execPath,
      args: [
        '--import',
        'tsx',
        '--test',
        '--test-reporter=dot',
        ...selected.native,
      ],
    });
  if (selected.emulator.length) {
    // Reuse the established demo-only emulator launcher and pin. Test paths are
    // quoted for the child command, never interpreted as shell instructions.
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    commands.push({
      executable: 'npx',
      args: [
        '--yes',
        'firebase-tools@13.35.1',
        'emulators:exec',
        '--only',
        'firestore,auth',
        '--project',
        'demo-bze-283',
        [
          'node',
          'node_modules/vitest/vitest.mjs',
          'run',
          '--config',
          'vitest.emulator.config.js',
          '--reporter=dot',
          ...selected.emulator,
        ]
          .map(quote)
          .join(' '),
      ],
    });
  }
  if (profile.structure) commands.push({ script: 'validate:project' });
  if (profile.build) commands.push({ script: 'build' });
  const gaps =
    profile.behavior.length &&
    discovered.size === 0 &&
    !profile.broadReasons.length
      ? [
          'No related automated test was found. Agent must provide meaningful manual/static proof in the PR; this is not an automated test pass.',
        ]
      : [];
  return {
    tier: profile.level,
    reason: profile.reason,
    profile,
    files,
    selected,
    gaps,
    commands,
  };
}

export function executePlan(plan, { spawn = spawnSync, dryRun = false } = {}) {
  console.log(
    `Scope: ${plan.tier}; review: ${plan.profile?.review ?? 'see policy'}\n${plan.reason}`
  );
  for (const gap of plan.gaps ?? [])
    console.log(`VERIFICATION LIMITATION: ${gap}`);
  for (const command of plan.commands) {
    const args = command.executable
      ? command.args
      : [
          'run',
          command.script,
          ...(command.fileArgs?.length ||
          ['test:node', 'test:ui', 'test:full'].includes(command.script)
            ? [
                '--',
                ...(command.fileArgs ?? []),
                ...(['test:node', 'test:ui', 'test:full'].includes(
                  command.script
                )
                  ? ['--reporter=dot']
                  : []),
              ]
            : []),
        ];
    const executable = command.executable ?? 'npm';
    console.log(
      `${dryRun ? 'Would run' : 'Running'}: ${executable} ${args.join(' ')}`
    );
    if (!dryRun) {
      const result = spawn(executable, args, { stdio: 'inherit' });
      if (result.error || result.status !== 0)
        throw new Error(
          `Selected check failed (${result.status ?? result.error?.message ?? 'signal'}): ${executable}`
        );
    }
  }
  console.log(
    dryRun
      ? 'Selection only; no checks executed.'
      : 'Selected commands passed. Missing coverage and unselected checks are not test passes.'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const ci = process.env.GITHUB_ACTIONS === 'true';
  if (args.some((arg) => arg.startsWith('--files')))
    throw new Error(
      '--files cannot replace complete-candidate detection; use a focused test command for iteration'
    );
  const changes = collectChanges({
    base: process.env.SCOUTZERO_DIFF_BASE,
    head: process.env.SCOUTZERO_DIFF_HEAD ?? 'HEAD',
    ci,
  });
  if (changes.uncertain)
    throw new Error(
      `Cannot establish complete change coverage: ${changes.reason}`
    );
  const plan = args.includes('--docs')
    ? {
        tier: 'documentation',
        reason: 'Changed documentation only',
        commands: documentationCommands(changes.files),
      }
    : await selectTestPlan(changes.files, changes);
  if (args.includes('--verbose') || args.includes('--ci-plan'))
    console.log(
      JSON.stringify(
        {
          base: changes.base,
          head: changes.head,
          ...plan,
          commands: plan.commands,
        },
        null,
        2
      )
    );
  const summary = `Validation: ${plan.tier}; review: ${plan.profile?.review ?? 'see policy'}\nBase: ${changes.base}; head: ${changes.head}\n${plan.reason}\n${(plan.gaps ?? []).join('\n')}\nUnselected checks are not executed passes.\n`;
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (args.includes('--ci-plan')) return;
  executePlan(plan, { dryRun: args.includes('--dry-run') });
}
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? ''))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
