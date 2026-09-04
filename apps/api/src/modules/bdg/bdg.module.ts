import { Module } from '@nestjs/common';
import { BdgService } from './bdg.service';
import { BdgController } from './bdg.controller';

@Module({
  providers: [BdgService],
  controllers: [BdgController],
  exports: [BdgService],
})
export class BdgModule {}
