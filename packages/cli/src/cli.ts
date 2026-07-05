#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { CliUsageError } from './errors.js';
import { loadInterviewCliConfig } from './config-loader.js';
import { runSimulation } from './commands/simulate.js';
import { loadBiasHarnessSamples, runBiasHarness } from './commands/bias-harness.js';
import { scaffoldServerRoute, type ScaffoldFramework } from './commands/init.js';
import { createQuestionPackFile, validateQuestionPackFile } from './commands/pack.js';
import { formatBiasHarnessReport, formatPackValidation, formatSimulationReport } from './format.js';
import { CLI_PACKAGE_NAME, CLI_PACKAGE_VERSION } from './index.js';

const HELP_TEXT = `${CLI_PACKAGE_NAME}@${CLI_PACKAGE_VERSION}

Usage:
  interview-sdk init [--framework nextjs|node] [--dir <path>] [--force]
  interview-sdk simulate --config <path> [--persona <id,id,...>] [--json]
  interview-sdk bias-harness --config <path> --samples <path> [--runs <n>] [--variance-threshold <n>] [--json]
  interview-sdk pack validate <file>
  interview-sdk pack init <name> <file> [--force]

All commands run locally or in your own CI — no maintainer-hosted service is involved.
`;

function parseNumberFlag(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CliUsageError(`--${name} must be a number, got "${value}".`);
  }
  return parsed;
}

async function runInit(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      framework: { type: 'string' },
      dir: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
  });
  const result = await scaffoldServerRoute({
    framework: values.framework as ScaffoldFramework | undefined,
    dir: values.dir,
    force: values.force,
  });
  console.log(`Wrote:\n${result.filesWritten.map((file) => `  ${file}`).join('\n')}`);
  return 0;
}

async function runSimulate(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      persona: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (!values.config) throw new CliUsageError('simulate requires --config <path>.');

  const config = await loadInterviewCliConfig(values.config);
  const personas = values.persona ? values.persona.split(',').map((id) => id.trim()) : undefined;
  const report = await runSimulation(config, { personas });

  console.log(formatSimulationReport(report, values.json));
  return report.warnings.length > 0 ? 1 : 0;
}

async function runBiasHarnessCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      samples: { type: 'string' },
      runs: { type: 'string' },
      'variance-threshold': { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (!values.config) throw new CliUsageError('bias-harness requires --config <path>.');
  if (!values.samples) throw new CliUsageError('bias-harness requires --samples <path>.');

  const config = await loadInterviewCliConfig(values.config);
  const samples = await loadBiasHarnessSamples(values.samples);
  const report = await runBiasHarness(config, samples, {
    runs: parseNumberFlag('runs', values.runs),
    varianceThreshold: parseNumberFlag('variance-threshold', values['variance-threshold']),
  });

  console.log(formatBiasHarnessReport(report, values.json));
  return report.warnings.length > 0 ? 1 : 0;
}

async function runPack(args: string[]): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === 'validate') {
    const [file] = rest;
    if (!file) throw new CliUsageError('pack validate requires a file path.');
    const result = await validateQuestionPackFile(file);
    console.log(formatPackValidation(result, file));
    return result.valid ? 0 : 1;
  }

  if (subcommand === 'init') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { force: { type: 'boolean', default: false } },
      allowPositionals: true,
    });
    const [name, file] = positionals;
    if (!name || !file) throw new CliUsageError('pack init requires <name> <file>.');
    await createQuestionPackFile(file, name, { force: values.force });
    console.log(`Wrote ${file}`);
    return 0;
  }

  throw new CliUsageError(
    `Unknown pack subcommand "${subcommand ?? ''}". Use "validate" or "init".`,
  );
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP_TEXT);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    console.log(`${CLI_PACKAGE_NAME}@${CLI_PACKAGE_VERSION}`);
    return 0;
  }

  try {
    switch (command) {
      case 'init':
        return await runInit(rest);
      case 'simulate':
        return await runSimulate(rest);
      case 'bias-harness':
        return await runBiasHarnessCommand(rest);
      case 'pack':
        return await runPack(rest);
      default:
        throw new CliUsageError(
          `Unknown command "${command}". Run "interview-sdk help" for usage.`,
        );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
