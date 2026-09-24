import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotFoundFilter } from './not-found.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Serve 404.html for unknown HTML page routes, plain JSON for missing assets
  app.useGlobalFilters(new NotFoundFilter());

  await app.listen(process.env.PORT || 3000);
  console.log('🚀 Application is running on: http://localhost:' + (process.env.PORT || 3000));
}

bootstrap();