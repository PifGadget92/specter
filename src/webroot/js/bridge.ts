import { shellEscape } from './utils.js';
import { EXEC_TIMEOUT_MS } from './constants.js';
import type { ModulePaths, ScriptResult, ExecResult, ChildProcess } from './types.js';

let MODULE: ModulePaths | null = null;

export async function initBridge(): Promise<void> {
  try {
    const r = await fetch('/json/module_paths.json');
    MODULE = await r.json() as ModulePaths;
    if (MODULE?.MODDIR) {
      MODULE.MODDIR = MODULE.MODDIR.replace('/modules_update/', '/modules/');
    }
  } catch (e) {
    console.warn('Bridge init parse fallback:', e);
    const src = (document.currentScript as HTMLScriptElement | null)?.src || '';
    const m = src.match(/^(file:\/\/\/data\/adb\/modules\/[^/]+)/);
    MODULE = m ? { MODDIR: m[1] } : null;
  }
  if (!MODULE) throw new Error('Cannot determine module path');
}

export function getModuleDir(): string | null {
  return MODULE?.MODDIR || null;
}

function scriptDir(type: string): string {
  const dirs: Record<string, string> = { feature: 'features', common: 'webroot/common' };
  const sub = dirs[type] || 'features';
  return `${MODULE!.MODDIR}/${sub}/`;
}

function getExecutor(): string | null {
  if (typeof window.ksu?.exec === 'function') return 'ksu';
  return null;
}

export function runScript(scriptName: string, type = 'feature'): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const executor = getExecutor();
    if (!executor) { reject(new Error('no-bridge')); return; }
    if (!MODULE) { reject(new Error('no-module-path')); return; }

    const scriptPath = scriptDir(type) + scriptName;
    const cbName = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let timer: ReturnType<typeof setTimeout>;

    function cleanup() { clearTimeout(timer); delete window[cbName]; }

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, EXEC_TIMEOUT_MS);

    window[cbName] = function (code: number | string, stdout?: string, stderr?: string) {
      cleanup();
      if (typeof code === 'number') {
        resolve({ success: code === 0, output: stdout || '', rawOutput: stdout || '' });
        return;
      }
      const result = parseScriptOutput(code);
      if (result.success) resolve(result);
      else reject(Object.assign(new Error('script-error'), { result }));
    } as any;

    try {
      window.ksu.exec(`sh ${shellEscape(scriptPath)}`, '{}', cbName);
    } catch (err) { cleanup(); reject(err); }
  });
}

export function exec(command: string): Promise<ExecResult> {
  return _runScriptRaw(command);
}

function _runScriptRaw(command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const executor = getExecutor();
    if (!executor) { reject(new Error('no-bridge')); return; }
    const cbName = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window[cbName] = function (code: number | string, stdout?: string, stderr?: string) {
      delete window[cbName];
      if (typeof code === 'number') {
        resolve({ code, stdout: stdout || '', stderr: stderr || '' });
        return;
      }
      if (!code) { resolve({ stdout: '', stderr: '' }); return; }
      try {
        const json = JSON.parse(code as string);
        resolve({
          stdout: json.result || json.stdout || json.output || '',
          stderr: json.stderr || json.error || '',
        });
      } catch (e) {
        console.warn('Exec JSON parse fallback:', e);
        resolve({ stdout: code as string, stderr: '' });
      }
    } as any;
    try {
      window.ksu.exec(command, '{}', cbName);
    } catch (e) { delete window[cbName]; reject(e); }
  });
}

function createChildProcess(): ChildProcess {
  const cbs: Record<string, Array<(...args: any[]) => void>> = { stdout: [], stderr: [], stdin: [], exit: [], error: [] };
  const child: ChildProcess = {
    stdout: {
      on(ev: 'data', fn: (data: string) => void) { if (ev === 'data') cbs.stdout.push(fn); },
      emit(ev: 'data', data: string) { if (ev === 'data') cbs.stdout.forEach(fn => fn(data)); },
    },
    stderr: {
      on(ev: 'data', fn: (data: string) => void) { if (ev === 'data') cbs.stderr.push(fn); },
      emit(ev: 'data', data: string) { if (ev === 'data') cbs.stderr.forEach(fn => fn(data)); },
    },
    stdin: { on() {}, emit() {} },
    on(ev: string, fn: (...args: any[]) => void) { if (cbs[ev]) cbs[ev].push(fn); },
    emit(ev: string, ...args: any[]) { if (cbs[ev]) cbs[ev].forEach(fn => fn(...args)); },
  };
  return child;
}

export function spawnScript(scriptName: string, type = 'feature'): ChildProcess {
  const executor = getExecutor();
  const child = createChildProcess();
  if (!executor) { setTimeout(() => child.emit('error', new Error('no-bridge'))); return child; }
  if (!MODULE) { setTimeout(() => child.emit('error', new Error('no-module-path'))); return child; }

  const scriptPath = scriptDir(type) + scriptName;

  if (executor === 'ksu' && typeof window.ksu?.spawn === 'function') {
    const cbName = `sp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    (window as any)[cbName] = child;
    child.on('exit', () => delete (window as any)[cbName]);
    child.on('error', () => delete (window as any)[cbName]);
    try {
      window.ksu.spawn('sh', JSON.stringify([scriptPath]), '{}', cbName);
    } catch (e) { delete (window as any)[cbName]; setTimeout(() => child.emit('error', e)); }
  } else {
    const cmd = `sh ${shellEscape(scriptPath)}`;
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.emit('error', new Error('timeout')); }, EXEC_TIMEOUT_MS);
    _runScriptRaw(cmd).then(({ code, stdout, stderr }) => {
      if (timedOut) return;
      clearTimeout(t);
      if (stdout) stdout.split('\n').forEach(l => l && child.stdout.emit('data', l));
      if (stderr) stderr.split('\n').forEach(l => l && child.stderr.emit('data', l));
      child.emit('exit', code);
    }).catch(e => { if (!timedOut) { clearTimeout(t); child.emit('error', e); } });
  }
  return child;
}

function parseScriptOutput(raw: string): ScriptResult {
  if (!raw) return { success: true, rawOutput: '' };
  try {
    const json = JSON.parse(raw);
    return {
      success: json.success !== false,
      output: json.result || json.stdout || json.output || '',
      rawOutput: raw,
    };
  } catch (e) {
    console.warn('Script output parse fallback:', e);
    const lower = raw.toLowerCase();
    const errorKeywords = ['not found', 'failed', 'error', 'permission denied', 'no such file'];
    const hasError = errorKeywords.some(kw => lower.includes(kw));
    return { success: !hasError, rawOutput: raw };
  }
}
