import { shellEscape, setGlobal, deleteGlobal, BridgeError, TimeoutError, ScriptError } from './utils.js';
import { EXEC_TIMEOUT_MS } from './constants.js';
import type { ModulePaths, ScriptResult, ExecResult, PackageInfo } from './types.js';

let MODULE: ModulePaths | null = null;

export async function initBridge(): Promise<void> {
  try {
    const r = await fetch('/json/module_paths.json');
    MODULE = await r.json() as ModulePaths;
    if (MODULE?.MODDIR) MODULE.MODDIR = MODULE.MODDIR.replace('/modules_update/', '/modules/');
  } catch {
    const m = (document.currentScript as HTMLScriptElement | null)?.src?.match(/^(file:\/\/\/data\/adb\/modules\/[^/]+)/);
    MODULE = m ? { MODDIR: m[1] } as ModulePaths : null;
  }
  if (!MODULE) throw new BridgeError('NO_MODULE', 'Cannot determine module path');
}

export function getModuleDir(): string | null { return MODULE?.MODDIR || null; }
export function getDataDir(): string | null { return MODULE?.SPECTER_DIR || null; }

function scriptDir(type: string): string {
  const dirs: Record<string, string> = { feature: 'features', common: 'webroot/common' };
  return MODULE ? `${MODULE.MODDIR}/${dirs[type] || 'features'}/` : '';
}

export function getPackagesInfo(packages: string[]): PackageInfo[] | null {
  const fn = (globalThis as any).ksu?.getPackagesInfo;
  if (typeof fn !== 'function') return null;
  try { return JSON.parse(fn(JSON.stringify(packages))) as PackageInfo[]; } catch { return null; }
}

function genCallbackName(): string { return `__sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }

export function runScript(scriptName: string, type = 'feature'): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    if (!window.ksu?.exec) { reject(new BridgeError('NO_BRIDGE', 'no-bridge')); return; }
    if (!MODULE) { reject(new BridgeError('NO_MODULE', 'no-module-path')); return; }

    const globalName = genCallbackName();
    const timer = setTimeout(() => { deleteGlobal(globalName); reject(new TimeoutError()); }, EXEC_TIMEOUT_MS);

    setGlobal(globalName, (code: unknown, stdout: unknown) => {
      clearTimeout(timer); deleteGlobal(globalName);
      if (typeof code === 'number') {
        resolve({ success: code === 0, output: typeof stdout === 'string' ? stdout : '', rawOutput: typeof stdout === 'string' ? stdout : '' });
      } else if (typeof code === 'string' && code) {
        try {
          const json = JSON.parse(code);
          if (json.success !== false) {
            resolve({ success: true, output: json.result || json.stdout || json.output || '', rawOutput: code });
          } else {
            reject(new ScriptError({ success: false, output: json.stdout || json.result || '', rawOutput: code }));
          }
        } catch {
          resolve({ success: false, output: code, rawOutput: code });
        }
      } else {
        resolve({ success: false, output: '', rawOutput: String(code || '') });
      }
    });

    try { window.ksu.exec(`sh ${shellEscape(scriptDir(type) + scriptName)}`, '{}', globalName); }
    catch (e) { clearTimeout(timer); deleteGlobal(globalName); reject(e); }
  });
}

export function exec(command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    if (!window.ksu?.exec) { reject(new BridgeError('NO_BRIDGE', 'no-bridge')); return; }

    const globalName = genCallbackName();
    const timer = setTimeout(() => { deleteGlobal(globalName); reject(new TimeoutError()); }, EXEC_TIMEOUT_MS);

    setGlobal(globalName, (code: unknown, stdout: unknown, stderr: unknown) => {
      clearTimeout(timer); deleteGlobal(globalName);
      if (typeof code === 'number') {
        resolve({ code, stdout: typeof stdout === 'string' ? stdout : '', stderr: typeof stderr === 'string' ? stderr : '' });
      } else if (typeof code === 'string' && code) {
        try {
          const json = JSON.parse(code);
          resolve({
            code: typeof json.code === 'number' ? json.code : json.success !== false ? 0 : 1,
            stdout: json.result || json.stdout || json.output || '',
            stderr: json.stderr || json.error || '',
          });
        } catch {
          resolve({ code: -1, stdout: code, stderr: '' });
        }
      } else {
        resolve({ code: -1, stdout: '', stderr: '' });
      }
    });

    try { window.ksu.exec(command, '{}', globalName); }
    catch (e) { clearTimeout(timer); deleteGlobal(globalName); reject(e); }
  });
}
