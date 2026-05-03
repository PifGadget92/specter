import { shellEscape } from './utils.js';
import { EXEC_TIMEOUT_MS } from './constants.js';

let MODULE = null;

export async function initBridge() {
  try {
    const r = await fetch('/json/module_paths.json?ts=' + Date.now());
    MODULE = await r.json();
    if (MODULE?.MODDIR) {
      MODULE.MODDIR = MODULE.MODDIR.replace('/modules_update/', '/modules/');
    }
    } catch { /* JSON/URL parse fallback */
    const src = document.currentScript?.src || '';
    const m = src.match(/^(file:\/\/\/data\/adb\/modules\/[^/]+)/);
    MODULE = m ? { MODDIR: m[1] } : null;
  }
  if (!MODULE) throw new Error('Cannot determine module path');
}

export function getModuleDir() {
  return MODULE?.MODDIR || null;
}

function scriptDir(type) {
  const dirs = { feature: 'features', common: 'webroot/common' };
  const sub = dirs[type] || 'features';
  return `${MODULE.MODDIR}/${sub}/`;
}

function getExecutor() {
  if (typeof window.ksu?.exec === 'function') return 'ksu';
  if (typeof window.YuriKeyHost?.execScript === 'function') return 'mmrl';
  if (typeof window.execYurikeyScript === 'function') return 'legacy-mmrl';
  return null;
}

export function runScript(scriptName, type = 'feature') {
  return new Promise((resolve, reject) => {
    const executor = getExecutor();
    if (!executor) { reject(new Error('no-bridge')); return; }
    if (!MODULE) { reject(new Error('no-module-path')); return; }

    const scriptPath = scriptDir(type) + scriptName;
    const cbName = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let timer;

    function cleanup() { clearTimeout(timer); delete window[cbName]; }

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, EXEC_TIMEOUT_MS);

    window[cbName] = function (code, stdout, stderr) {
      cleanup();
      if (typeof code === 'number') {
        resolve({ success: code === 0, output: stdout || '', rawOutput: stdout || '' });
        return;
      }
      const result = parseScriptOutput(code);
      if (result.success) resolve(result);
      else reject(Object.assign(new Error('script-error'), { result }));
    };

    try {
      if (executor === 'mmrl') {
        window.YuriKeyHost.execScript(`sh ${shellEscape(scriptPath)}`, '{}', cbName);
      } else if (executor === 'legacy-mmrl') {
        window.execYurikeyScript(scriptPath, cbName);
      } else {
        window.ksu.exec(`sh ${shellEscape(scriptPath)}`, '{}', cbName);
      }
    } catch (err) { cleanup(); reject(err); }
  });
}

export function exec(command) {
  return _runScriptRaw(command);
}

function _runScriptRaw(command) {
  return new Promise((resolve, reject) => {
    const executor = getExecutor();
    if (!executor) { reject(new Error('no-bridge')); return; }
    const cbName = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window[cbName] = function (code, stdout, stderr) {
      delete window[cbName];
      if (typeof code === 'number') {
        resolve({ code, stdout: stdout || '', stderr: stderr || '' });
        return;
      }
      if (!code) { resolve({ stdout: '', stderr: '' }); return; }
      try {
        const json = JSON.parse(code);
        resolve({
          stdout: json.result || json.stdout || json.output || '',
          stderr: json.stderr || json.error || '',
        });
      } catch { /* JSON.parse fallback */
        resolve({ stdout: code, stderr: '' });
      }
    };
    try {
      if (executor === 'mmrl') {
        window.YuriKeyHost.execScript(command, '{}', cbName);
      } else if (executor === 'legacy-mmrl') {
        window.execYurikeyScript(command, cbName);
      } else {
        window.ksu.exec(command, '{}', cbName);
      }
    } catch (e) { delete window[cbName]; reject(e); }
  });
}

function createChildProcess() {
  const cbs = { stdout: [], stderr: [], stdin: [], exit: [], error: [] };
  const child = {
    stdout: {
      on(ev, fn) { if (ev === 'data') cbs.stdout.push(fn); },
      emit(ev, data) { if (ev === 'data') cbs.stdout.forEach(fn => fn(data)); },
    },
    stderr: {
      on(ev, fn) { if (ev === 'data') cbs.stderr.push(fn); },
      emit(ev, data) { if (ev === 'data') cbs.stderr.forEach(fn => fn(data)); },
    },
    stdin: { on() {}, emit() {} },
    on(ev, fn) { if (cbs[ev]) cbs[ev].push(fn); },
    emit(ev, ...args) { if (cbs[ev]) cbs[ev].forEach(fn => fn(...args)); },
  };
  return child;
}

export function spawnScript(scriptName, type = 'feature') {
  const executor = getExecutor();
  const child = createChildProcess();
  if (!executor) { setTimeout(() => child.emit('error', new Error('no-bridge'))); return child; }
  if (!MODULE) { setTimeout(() => child.emit('error', new Error('no-module-path'))); return child; }

  const scriptPath = scriptDir(type) + scriptName;

  if (executor === 'ksu' && typeof window.ksu?.spawn === 'function') {
    const cbName = `sp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window[cbName] = child;
    child.on('exit', () => delete window[cbName]);
    child.on('error', () => delete window[cbName]);
    try {
      window.ksu.spawn('sh', JSON.stringify([scriptPath]), '{}', cbName);
    } catch (e) { delete window[cbName]; setTimeout(() => child.emit('error', e)); }
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

function parseScriptOutput(raw) {
  if (!raw) return { success: true, rawOutput: '' };
  try {
    const json = JSON.parse(raw);
    return {
      success: json.success !== false,
      output: json.result || json.stdout || json.output || '',
      rawOutput: raw,
    };
  } catch { /* JSON.parse fallback */
    const lower = raw.toLowerCase();
    const errorKeywords = ['not found', 'failed', 'error', 'permission denied', 'no such file'];
    const hasError = errorKeywords.some(kw => lower.includes(kw));
    return { success: !hasError, rawOutput: raw };
  }
}
