import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportModule } from '@prisma/client';
import { ImportsService } from './imports.service';

class ModuleBodyDto {
  @IsEnum(ReportModule)
  module!: ReportModule;
}

class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(ReportModule)
  module?: ReportModule;
}

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  /** In-memory preview only — no Upload / ImportJob / data rows written */
  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ModuleBodyDto,
  ) {
    if (!body.module) {
      throw new BadRequestException('module is required (BDG or PODS)');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.imports.previewFromFile(file, body.module);
  }

  /** Persist file + upsert records. Only called when user confirms import. */
  @Post('commit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  commit(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ModuleBodyDto,
  ) {
    if (!body.module) {
      throw new BadRequestException('module is required (BDG or PODS)');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.imports.commitFromFile(file, body.module);
  }

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.imports.findAll(query.page, query.pageSize, query.module);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imports.findOne(id);
  }
}
