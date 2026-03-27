import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'packages/design-tokens');
const tokensPath = path.join(root, 'src', 'tokens.json');
const cssPath = path.join(root, 'dist', 'tokens.css');
const swiftPath = path.join(root, 'dist', 'RecallTokens.swift');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

const cssLines = [':root {'];
for (const [key, value] of Object.entries(tokens.color)) {
  cssLines.push(`  --recall-color-${kebab(key)}: ${value};`);
}
for (const [key, value] of Object.entries(tokens.spacing)) {
  cssLines.push(`  --recall-space-${kebab(key)}: ${value}px;`);
}
for (const [key, value] of Object.entries(tokens.radius)) {
  cssLines.push(`  --recall-radius-${kebab(key)}: ${value}px;`);
}
for (const [key, value] of Object.entries(tokens.typography)) {
  cssLines.push(`  --recall-font-${kebab(key)}: ${value}px;`);
}
for (const [key, value] of Object.entries(tokens.motion)) {
  cssLines.push(`  --recall-motion-${kebab(key)}: ${value}s;`);
}
cssLines.push('}');

const swiftLines = [
  'import SwiftUI',
  '',
  'enum RecallTokens {',
  '  enum ColorToken {'
];
for (const [key, value] of Object.entries(tokens.color)) {
  swiftLines.push(`    static let ${key} = Color(hex: "${value}")`);
}
swiftLines.push('  }', '', '  enum Space {');
for (const [key, value] of Object.entries(tokens.spacing)) {
  swiftLines.push(`    static let ${key}: CGFloat = ${value}`);
}
swiftLines.push('  }', '', '  enum Radius {');
for (const [key, value] of Object.entries(tokens.radius)) {
  swiftLines.push(`    static let ${key}: CGFloat = ${value}`);
}
swiftLines.push('  }', '}');

fs.writeFileSync(cssPath, `${cssLines.join('\n')}\n`);
fs.writeFileSync(swiftPath, `${swiftLines.join('\n')}\n`);

function kebab(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
