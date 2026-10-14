import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('api')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * SPA fallback: /index.html and /index.html/* all serve index.html
   * so the frontend router (pushState) handles the routing.
   */
  @Get('index.html')
  spaRoot(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }

  @Get('index.html/*')
  spaFallback(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }

  @Get('analytics.html')
  analyticsPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'analytics.html'));
  }

  @Get('requests.html')
  requestsPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'requests.html'));
  }

  @Get('claims.html')
  claimsPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'claims.html'));
  }

  @Get('conversations.html')
  conversationsPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'conversations.html'));
  }

  @Get('conversation-detail.html')
  conversationDetailPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'conversation-detail.html'));
  }

  @Get('brands.html')
  brandsPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'brands.html'));
  }

  @Get('request-detail.html')
  requestDetailPage(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'pages', 'request-detail.html'));
  }
}