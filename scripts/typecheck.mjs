import path from "node:path";
import process from "node:process";
import ts from "typescript";

const DEFAULT_PROJECTS = [
  "kubejs_ts/client/tsconfig.json",
  "kubejs_ts/server/tsconfig.json",
  "kubejs_ts/shared/tsconfig.json",
  "kubejs_ts/startup/tsconfig.json",
];

const projectPaths =
  process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_PROJECTS;

const formatHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => ts.sys.newLine,
};

let hasReportedErrors = false;
let ignoredDiagnosticsCount = 0;

for (const projectPath of projectPaths) {
  const {
    projectLabel,
    reportedDiagnostics,
    ignoredCount,
  } = getProjectDiagnostics(projectPath);

  ignoredDiagnosticsCount += ignoredCount;

  if (reportedDiagnostics.length === 0) {
    continue;
  }

  hasReportedErrors = true;

  console.error(`\n[${projectLabel}]`);
  console.error(
    ts
      .formatDiagnosticsWithColorAndContext(reportedDiagnostics, formatHost)
      .trimEnd(),
  );
}

if (!hasReportedErrors && ignoredDiagnosticsCount > 0) {
  console.log(
    `Typecheck passed. Ignored ${ignoredDiagnosticsCount} diagnostics from .probe.`,
  );
}

if (hasReportedErrors) {
  process.exit(1);
}

function getProjectDiagnostics(projectPath) {
  const configPath = path.resolve(projectPath);
  const projectLabel = path.relative(process.cwd(), configPath);

  const configResult = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configResult.error) {
    return {
      projectLabel,
      reportedDiagnostics: [configResult.error],
      ignoredCount: 0,
    };
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );

  const allDiagnostics = [...parsedConfig.errors];

  if (allDiagnostics.length === 0) {
    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
      projectReferences: parsedConfig.projectReferences,
    });

    allDiagnostics.push(...ts.getPreEmitDiagnostics(program));
  }

  const reportedDiagnostics = [];
  let ignoredCount = 0;

  for (const diagnostic of allDiagnostics) {
    if (isProbeDiagnostic(diagnostic)) {
      ignoredCount++;
      continue;
    }

    reportedDiagnostics.push(diagnostic);
  }

  return {
    projectLabel,
    reportedDiagnostics,
    ignoredCount,
  };
}

function isProbeDiagnostic(diagnostic) {
  if (!diagnostic.file?.fileName) {
    return false;
  }

  const normalizedPath = path.normalize(diagnostic.file.fileName);
  const probeSegment = `${path.sep}.probe${path.sep}`;

  return normalizedPath.includes(probeSegment);
}
