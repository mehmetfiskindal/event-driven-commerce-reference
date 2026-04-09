type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMetadata = Record<string, unknown>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function writeLog(
  level: LogLevel,
  context: string,
  message: string,
  metadata?: LogMetadata,
) {
  const logEntry = {
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    ...(metadata ?? {}),
  };

  const output = JSON.stringify(logEntry, (_, value) => serializeError(value));

  switch (level) {
    case 'error':
      console.error(output);
      return;
    case 'warn':
      console.warn(output);
      return;
    case 'debug':
      console.debug(output);
      return;
    default:
      console.info(output);
  }
}

export function createLogger(context: string) {
  return {
    debug(message: string, metadata?: LogMetadata) {
      writeLog('debug', context, message, metadata);
    },
    info(message: string, metadata?: LogMetadata) {
      writeLog('info', context, message, metadata);
    },
    warn(message: string, metadata?: LogMetadata) {
      writeLog('warn', context, message, metadata);
    },
    error(message: string, metadata?: LogMetadata) {
      writeLog('error', context, message, metadata);
    },
  };
}

export type AppLogger = ReturnType<typeof createLogger>;

