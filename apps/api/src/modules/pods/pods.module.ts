import { Module } from '@nestjs/common';
import { PodsService } from './pods.service';
import { PodsController } from './pods.controller';

@Module({
  providers: [PodsService],
  controllers: [PodsController],
  exports: [PodsService],
})
export class PodsModule {}
