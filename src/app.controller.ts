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

  private serveSpa(res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }

  @Get('login')
  loginRoute(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'login.html'));
  }

  @Get()
  homeRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('index.html')
  spaRoot(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('index.html/*')
  spaFallback(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('analytics')
  analyticsRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('requests')
  requestsRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('requests/:id')
  requestDetailRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('claims')
  claimsRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('conversations')
  conversationsRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('conversations/:requestId')
  conversationDetailRoute(@Res() res: Response) {
    this.serveSpa(res);
  }

  @Get('brands')
  brandsRoute(@Res() res: Response) {
    this.serveSpa(res);
  }
}