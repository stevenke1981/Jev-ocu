#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
export function installWindows(agent, { home = os.homedir(), workspace, force = false, legacy = false } = {}) {
  const paths = { codex: '.agents/skills', pi: '.pi/agent/skills', agy: '.gemini/config/skills', 'agy-cli': '.gemini/antigravity-cli/skills', opencode: '.config/opencode/skills', generic: '.agents/skills', claude: '.claude/skills' };
  if (!Object.hasOwn(paths, agent)) throw new Error('Agent must be codex, pi, agy, agy-cli, opencode, claude or generic');
  const skill = path.join(workspace ? path.resolve(workspace, agent === 'pi' ? '.pi/skills' : '.agents/skills') : path.join(home, paths[agent]), 'jev-windows');
  const extension = agent === 'pi' ? path.join(workspace ? path.resolve(workspace, '.pi/extensions') : path.join(home, '.pi/agent/extensions'), 'jev-windows.ts') : null;
  const files = [skill, extension].filter(Boolean);
  for (const p of files) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error('Refusing to overwrite symlink: ' + p);
    if (fs.existsSync(p) && !force) throw new Error('Already installed; use --force to back up and replace: ' + p);
  }
  const backups = [];
  for (const p of files) if (fs.existsSync(p)) { const b = p + '.backup-' + Date.now(); fs.renameSync(p, b); backups.push(b); }
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), fs.readFileSync(path.join(DIR, 'skill/SKILL.md'), 'utf8').replaceAll('{{WINDOWS_DIR}}', DIR.replaceAll('\\', '/')));
  if (extension) {
    fs.mkdirSync(path.dirname(extension), { recursive: true });
    fs.writeFileSync(extension, `// Generated loader; repository must remain at this path.\nexport { default } from ${JSON.stringify(pathToFileURL(path.join(DIR, legacy ? 'pi-extension-legacy.ts' : 'pi-extension.ts')).href)};\n`);
  }
  return { skill, extension, backups, mcpSettingsChanged: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2), w = args.indexOf('--workspace');
    if (w >= 0 && (!args[w + 1] || args[w + 1].startsWith('--'))) throw new Error('--workspace requires a directory');
    console.log(JSON.stringify(installWindows(args[0], { force: args.includes('--force'), legacy: args.includes('--legacy'), workspace: w < 0 ? undefined : args[w + 1] }), null, 2));
  } catch (err) { console.error(err.message); process.exitCode = 1; }
}
