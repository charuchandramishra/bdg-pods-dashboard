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
import { UploadsService } from './uploads.service';

class UploadBodyDto {
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
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadBodyDto,
  ) {
    if (!body.module) {
      throw new BadRequestException('module is required (BDG or PODS)');
    }
    return this.uploads.create(file, body.module);
  }

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.uploads.findAll(query.page, query.pageSize);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.uploads.findOne(id);
  }
}
