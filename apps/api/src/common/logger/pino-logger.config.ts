import { Params } from 'nestjs-pino';

const isProduction = process.env.NODE_ENV === 'production';

export const pinoLoggerConfig: Params = {
  pinoHttp: {
    level: isProduction ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: 'SYS:standard',
            singleLine: true,
          },
        },
  },
};
