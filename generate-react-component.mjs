#!/usr/bin/env node
/**
 * React Component Generator
 * -------------------------
 * Creates a React component (TSX) with optional CSS Module, test file, and index barrel.
 *
 * Usage:
 *   node generate-react-component.mjs Button --path src/components/ui --style module --test --client
 *
 * Options:
 *   --path <dir>     Output directory (default: src/components)
 *   --style <type>   module|css|none (default: none)
 *   --test           Add a Vitest/RTL test
 *   --client         Add `"use client"` directive (default false)
 *   --force          Overwrite existing files
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Component name is required.');
  process.exit(1);
}
const name = args[0];
const opts = {
  outDir: 'src/components',
  style: 'none',
  test: false,
  client: false,
  force: false,
};

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--path') opts.outDir = args[++i];
  else if (a === '--style') opts.style = args[++i];
  else if (a === '--test') opts.test = true;
  else if (a === '--client') opts.client = true;
  else if (a === '--force') opts.force = true;
}

const toPascal = (s) => s.replace(/(^|[-_ ]+)([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');
const toKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
const Cmp = toPascal(name);
const kebab = toKebab(Cmp);

const dir = path.join(process.cwd(), opts.outDir, Cmp);
await mkdir(dir, { recursive: true });

async function guard(file) {
  try { await access(file, constants.F_OK); if (!opts.force) { throw new Error(`File exists: ${file} (use --force to overwrite)`); } }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}

function componentTsx() {
  const useClient = opts.client ? '"use client"\n\n' : '';
  const styleImport = opts.style === 'module' ? `import styles from './${kebab}.module.css'\n` :
                       opts.style === 'css' ? `import './${kebab}.css'\n` : '';
  return `${useClient}import React from 'react'\n${styleImport}
export type ${Cmp}Props = {
  children?: React.ReactNode
  className?: string
}

export default function ${Cmp}({ children, className }: ${Cmp}Props) {
  return (
    <div className={className${opts.style === 'module' ? " ?? styles.root" : ""}}>
      {children ?? '${Cmp} component'}
    </div>
  )
}
`;
}

function styleModule() {
  return `/* ${Cmp} styles */\n.root {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n`;
}

function styleCss() {
  return `/* ${Cmp} styles (global CSS) */\n.${kebab} {\n  display: flex;\n}\n`;
}

function testFile() {
  return `import { describe, it, expect } from 'vitest'\nimport { render, screen } from '@testing-library/react'\nimport React from 'react'\nimport ${Cmp} from './${Cmp}'\n\ndescribe('${Cmp}', () => {\n  it('renders', () => {\n    render(<${Cmp} />)\n    expect(screen.getByText('${Cmp} component')).toBeInTheDocument()\n  })\n})\n`;
}

function barrel() {
  return `export { default } from './${Cmp}'\nexport type { ${Cmp}Props } from './${Cmp}'\n`;
}

const filesToWrite = [
  { path: path.join(dir, `${Cmp}.tsx`), content: componentTsx() },
  { path: path.join(dir, `index.ts`), content: barrel() },
];

if (opts.style === 'module') {
  filesToWrite.push({ path: path.join(dir, `${kebab}.module.css`), content: styleModule() });
} else if (opts.style === 'css') {
  filesToWrite.push({ path: path.join(dir, `${kebab}.css`), content: styleCss() });
}

if (opts.test) {
  filesToWrite.push({ path: path.join(dir, `${Cmp}.test.tsx`), content: testFile() });
}

for (const f of filesToWrite) {
  await guard(f.path);
  await writeFile(f.path, f.content, 'utf8');
  console.log('Created', path.relative(process.cwd(), f.path));
}
console.log('✅ Done.');
