import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to GeoMedia GEO Optimization Service API!';
  }
}