import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const projects = ['mfe-shell', 'mfe-orders', 'mfe-inventory'];
const scopes = [
  ...projects.map((project) => ({ root: path.resolve(project, 'src'), application: true })),
  { root: path.resolve('shared/auth-contract'), application: false },
  { root: path.resolve('shared/notifications'), application: false },
];
const sharedContracts = new Set(['@pulseops/auth-contract', '@pulseops/notifications']);
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)],
    ),
  );
  return nested.flat().filter((file) => file.endsWith('.ts'));
}
function imports(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const result = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      result.push(node.argument.literal.text);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const specifier = node.arguments[0];
      if (!specifier || !ts.isStringLiteral(specifier))
        throw new Error(
          `${file}: non-literal dependency is not allowed by the starter boundary policy`,
        );
      result.push(specifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}
let failed = false;
for (const { root: sourceRoot, application } of scopes) {
  for (const file of await files(sourceRoot)) {
    for (const specifier of imports(await readFile(file, 'utf8'), file)) {
      const approvedPackage =
        /^(@angular\/|rxjs(?:\/|$))/.test(specifier) ||
        (file.endsWith('.test.ts') && specifier.startsWith('node:')) ||
        (application &&
          (specifier === '@angular-architects/native-federation-v4' ||
            sharedContracts.has(specifier)));
      const local =
        specifier.startsWith('.') &&
        path.resolve(path.dirname(file), specifier).startsWith(sourceRoot + path.sep);
      if (!approvedPackage && !local) {
        console.error(`${file}: forbidden dependency ${specifier}`);
        failed = true;
      }
    }
  }
}
if (failed) process.exit(1);
console.log(
  'Boundaries passed: domains consume only approved shared contracts; shared modules cannot import applications or each other.',
);
