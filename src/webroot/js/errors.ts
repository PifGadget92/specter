import { getTranslation } from './i18n.js';

const t = (key: string, fallback: string): string => getTranslation(key) || fallback;

/** Base error for all Specter application errors. Includes a machine-readable `code` and optional `context` payload. */
export class SpecterError extends Error {
  readonly code: string
  readonly context?: Record<string, unknown>

  constructor(code: string, message: string, context?: Record<string, unknown>) {
    super(message)
    this.name = 'SpecterError'
    this.code = code
    this.context = context
  }
}

/** Error originating from the KernelSU bridge layer (no bridge, timeout, script failure). */
export class BridgeError extends SpecterError {
  constructor(code: string, message: string, context?: Record<string, unknown>) {
    super(code, message, context)
    this.name = 'BridgeError'
  }
}

/** A shell script exited with a non-zero status and its output indicated failure. */
export class ScriptError extends BridgeError {
  readonly result?: { success: boolean; output?: string; rawOutput: string }

  constructor(result: { success: boolean; output?: string; rawOutput: string }) {
    super('SCRIPT_ERROR', t('error_script_failed', 'Script execution failed'), { result })
    this.name = 'ScriptError'
    this.result = result
  }
}

/** A bridge operation exceeded the configured timeout. */
export class TimeoutError extends BridgeError {
  constructor() {
    super('TIMEOUT', t('error_operation_timed_out', 'Operation timed out'))
    this.name = 'TimeoutError'
  }
}

/** Error in the persistent config layer. */
export class ConfigError extends SpecterError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFIG_ERROR', message, context)
    this.name = 'ConfigError'
  }
}
