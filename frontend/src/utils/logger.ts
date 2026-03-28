type LogContext = Record<string, any>;

/**
 * Industrial-grade Structured Logger.
 * Ensures all logs across the client-side system follow an observable standard.
 * Format: [YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [Module/Function] - Message - {Context Data}
 */
class StructuredLogger {
  private format(
    level: string,
    module: string,
    message: string,
    context?: LogContext
  ) {
    const d = new Date();
    const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
      2,
      "0"
    )}:${String(d.getMinutes()).padStart(2, "0")}:${String(
      d.getSeconds()
    ).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;

    const contextStr = context ? JSON.stringify(context) : "{}";
    return `[${ts}] [${level}] [${module}] - ${message} - ${contextStr}`;
  }

  debug(module: string, message: string, context?: LogContext) {
    console.debug(this.format("DEBUG", module, message, context));
  }

  info(module: string, message: string, context?: LogContext) {
    console.info(this.format("INFO", module, message, context));
  }

  warn(module: string, message: string, context?: LogContext) {
    console.warn(this.format("WARN", module, message, context));
  }

  error(module: string, message: string, context?: LogContext, err?: unknown) {
    // If a standard error is passed, serialize it alongside the formatted message
    console.error(this.format("ERROR", module, message, context), err ? err : "");
  }
}

export const logger = new StructuredLogger();
