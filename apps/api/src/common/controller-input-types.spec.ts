import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import * as ts from 'typescript';

const MODULES_DIR = join(__dirname, '..', 'modules');
const ERASED_TYPES = new Set(['Partial', 'Array', 'Record', 'Pick', 'Omit', 'Object', 'Required']);
// Slack payloads are verified by signature in the webhook guard and are not user-shaped DTOs.
const ALLOWED_FILES = new Set(['v1/webhooks/controllers/webhooks.controller.ts']);
const INPUT_DECORATORS = new Set(['Body', 'Query']);

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return controllerFiles(path);
    return name.endsWith('.controller.ts') ? [path] : [];
  });
}

function decoratorsOf(node: ts.ParameterDeclaration): readonly ts.Decorator[] {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined) ?? [];
}

function wholeObjectInput(decorator: ts.Decorator): boolean {
  const call = decorator.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return false;
  return INPUT_DECORATORS.has(call.expression.text) && call.arguments.length === 0;
}

function typeOnlyImports(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
    if (!clause?.isTypeOnly) continue;
    if (clause.name) names.add(clause.name.text);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) names.add(element.name.text);
    }
  }
  return names;
}

function localInterfaces(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      names.add(statement.name.text);
    }
  }
  return names;
}

export function findUnvalidatedInputs(file: string, text = readFileSync(file, 'utf8')): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const typeOnly = typeOnlyImports(source);
  const local = localInterfaces(source);
  const problems: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isParameter(node) && decoratorsOf(node).some(wholeObjectInput)) {
      const type = node.type;
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const where = `${file.replace(MODULES_DIR, '').slice(1)}:${line}`;
      if (!type || ts.isTypeLiteralNode(type) || ts.isArrayTypeNode(type)) {
        problems.push(`${where} inline or array type`);
      } else if (ts.isIntersectionTypeNode(type) || ts.isUnionTypeNode(type)) {
        problems.push(`${where} intersection/union type`);
      } else if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
        const name = type.typeName.text;
        if (ERASED_TYPES.has(name)) problems.push(`${where} ${name}<…>`);
        else if (typeOnly.has(name)) problems.push(`${where} ${name} imported with "import type"`);
        else if (local.has(name)) problems.push(`${where} ${name} is an interface or type alias`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return problems;
}

describe('controller input types', () => {
  it('only binds @Body() and @Query() to validatable classes', () => {
    const problems = controllerFiles(MODULES_DIR)
      .filter((file) => !ALLOWED_FILES.has(file.replace(MODULES_DIR, '').slice(1)))
      .flatMap((file) => findUnvalidatedInputs(file));
    expect(problems).toEqual([]);
  });

  it('catches the patterns it is meant to ban', () => {
    const fixture = join(MODULES_DIR, 'fixture.controller.ts');
    const bad = [
      "import type { FooDto } from './foo.dto';",
      'interface Filters { a?: string }',
      'class C {',
      '  a(@Body() b: { x: number }) {}',
      '  b(@Body() b: Partial<Thing>) {}',
      '  c(@Query() q: Filters) {}',
      '  d(@Body() b: FooDto) {}',
      '  e(@Body() b: A & B) {}',
      "  f(@Query('x') x?: string) {}",
      '}',
    ].join('\n');
    expect(findUnvalidatedInputs(fixture, bad)).toHaveLength(5);
  });
});
