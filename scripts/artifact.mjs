// Turns the single-file build into the artifact page format: the artifact host supplies the
// doctype, <html>, <head> and <body>, so the page is published as title, styles and body content only.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();
writeFileSync('dist/artifact.html', keep + '\n' + body.trim() + '\n');
console.log('dist/artifact.html', Math.round(Buffer.byteLength(keep + body) / 1024), 'KB');
