import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { ROOT } from './openrouter.mjs';
export const APP_SKILLS = Object.freeze(['jev-desktop-context', 'jev-paint', 'jev-davinci-resolve', 'jev-capcut']);
const paths = { codex: '.agents/skills', pi: '.pi/agent/skills', agy: '.gemini/config/skills', 'agy-cli': '.gemini/antigravity-cli/skills', opencode: '.config/opencode/skills', claude: '.claude/skills', generic: '.agents/skills' };
const exists = p => { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
/** Transactional skill-only installation. No runtime, config, permissions, keys, or model calls. */
export function installAppSkills(agent, { root = ROOT, home = os.homedir(), workspace, force = false, uninstall = false } = {}) {
  if (!Object.hasOwn(paths, agent)) throw new Error('Choose codex, pi, agy, agy-cli, opencode, claude or generic');
  const base = workspace ? path.resolve(workspace, agent === 'pi' ? '.pi/skills' : '.agents/skills') : path.join(home, paths[agent]);
  const control = path.resolve(workspace ?? home, '.jev-ocu');
  const batch = randomUUID(), staging = path.join(control, 'staging', batch), backups = path.join(control, 'skill-backups', batch);
  const entries = APP_SKILLS.map(name => ({ name, source: path.join(root, 'skill', name), dest: path.join(base, name), stage: path.join(staging, name), backup: null }));
  for (const e of entries) {
    if (exists(e.dest) && fs.lstatSync(e.dest).isSymbolicLink()) throw new Error(`Refusing to replace symlink: ${e.name}`);
    if (exists(e.dest) && !force && !uninstall) throw new Error(`Skill exists: ${e.name}; --force archives before replacement`);
    if (!uninstall && !fs.existsSync(path.join(e.source, 'SKILL.md'))) throw new Error(`Missing source skill: ${e.name}`);
  }
  const moved = [], installed = [];
  try {
    if (!uninstall) {
      for (const e of entries) {
        fs.cpSync(e.source, e.stage, { recursive: true, filter: p => { if (fs.lstatSync(p).isSymbolicLink()) throw new Error('Source skill contains symlink'); return true; } });
        const render = dir => {
          for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, item.name);
            if (item.isDirectory()) render(file);
            else fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('{{REPO_DIR}}', path.resolve(root).replaceAll('\\', '/')));
          }
        };
        render(e.stage);
      }
    }
    for (const e of entries) {
      if (exists(e.dest)) {
        fs.mkdirSync(backups, { recursive: true }); e.backup = path.join(backups, e.name);
        fs.renameSync(e.dest, e.backup); moved.push(e);
      }
      if (!uninstall) { fs.mkdirSync(base, { recursive: true }); fs.renameSync(e.stage, e.dest); installed.push(e); }
    }
  } catch (err) {
    for (const e of installed.reverse()) fs.rmSync(e.dest, { recursive: true, force: true });
    for (const e of moved.reverse()) fs.renameSync(e.backup, e.dest);
    throw err;
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  return { agent, installed: !uninstall, skills: entries.map(e => ({ name: e.name, destination: e.dest, backup: e.backup })),
    credentialsChanged: false, configChanged: false, note: 'Restart or reload the host. Read the actual selected backend tool guidance before operating.' };
}
