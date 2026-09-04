import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { ParserModule } from '../../parsers/parser.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [ParserModule, UploadsModule],
  providers: [ImportsService],
  controllers: [ImportsController],
  exports: [ImportsService],
})
export class ImportsModule {}
