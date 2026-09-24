import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';

/**
 * Catches all 404 NotFoundException errors.
 * - Static asset requests (.css, .js, .png, etc.) → plain 404 JSON
 * - All other unknown paths (HTML page routes) → serve 404.html
 */
@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // If it looks like a static asset, don't serve the HTML 404 page
    const isStaticAsset = /\.(css|js|map|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)(\?.*)?$/.test(
      req.url,
    );

    if (isStaticAsset) {
      res.status(404).json({ statusCode: 404, message: 'Not Found' });
      return;
    }

    // For all other unknown paths, serve the 404 page
    res.status(404).sendFile(join(__dirname, '..', 'public', '404.html'));
  }
}
