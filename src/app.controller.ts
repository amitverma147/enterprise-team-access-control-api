import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

/**
 * FILE PURPOSE
 * Root controller. Currently just exposes a public health-check endpoint,
 * useful for Docker/orchestrator liveness probes (Phase 21).
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
