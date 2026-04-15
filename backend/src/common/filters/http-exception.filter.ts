import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger.service';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object') {
        const res = exResponse as any;
        message = res.message || message;
        errors = res.errors;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const meta = {
      path: request?.url,
      method: request?.method,
      status,
      ip: request?.ip,
    };

    if (status >= 500) {
      this.logger.fatal(
        `Unhandled ${status}: ${message}`,
        'ExceptionFilter',
        { ...meta, stack: (exception as any)?.stack },
      );
    } else if (status === 401 || status === 403 || status === 429) {
      this.logger.high(`${status} ${message}`, 'ExceptionFilter', meta);
    } else if (status >= 400) {
      this.logger.medium(`${status} ${message}`, 'ExceptionFilter', meta);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}
