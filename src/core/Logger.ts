import debug from 'debug';

let logger: debug.Debugger;

const buildLogger = (appName: string) => {
  if (logger) {
    return logger;
  }

  debug.enable(`${appName}*`);
  logger = debug(appName);

  return logger;
};

export default buildLogger(process.env.APPNAME || 'NoAppName');
