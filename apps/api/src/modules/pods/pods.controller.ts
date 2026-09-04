import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PodsService, PodUpsertDto } from './pods.service';

class PodsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  statuses?: string;

  @IsOptional()
  @IsString()
  ids?: string;

  @IsOptional()
  @IsString()
  developer?: string;

  @IsOptional()
  @IsString()
  startDateFrom?: string;

  @IsOptional()
  @IsString()
  startDateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  completionMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  completionMax?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  format?: 'csv' | 'xlsx';

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  range?: 'all' | 'daily' | 'weekly' | 'custom';
}

class PodBodyDto implements PodUpsertDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  status?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  developers?: string | null;

  @IsOptional()
  @IsString()
  machineOwner?: string | null;

  @IsOptional()
  @IsString()
  machineAlignedToProject?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  feCompletion?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  beCompletion?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  integrationCompletion?: number | null;
}

@Controller('pods')
export class PodsController {
  constructor(private readonly pods: PodsService) {}

  @Get('summary')
  summary() {
    return this.pods.summary();
  }

  @Get('status')
  status(@Query() query: PodsQueryDto) {
    return this.pods.statusDistribution(query);
  }

  @Get('completion')
  completion(@Query() query: PodsQueryDto) {
    return this.pods.completion(query.limit ?? 20, query);
  }

  @Get('export')
  async export(@Query() query: PodsQueryDto, @Res() res: Response) {
    const rows = await this.pods.exportAll(query);
    if (query.format === 'xlsx') {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'PODS');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="pods-export.xlsx"',
      );
      return res.send(buf);
    }

    const headers = [
      'name',
      'status',
      'startDate',
      'developers',
      'machineOwner',
      'machineAlignedToProject',
      'feCompletion',
      'beCompletion',
      'integrationCompletion',
      'overallCompletion',
      'updatedAt',
    ];
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = (r as Record<string, unknown>)[h];
            const s = v === null || v === undefined ? '' : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="pods-export.csv"',
    );
    return res.send(csv);
  }

  @Post()
  create(@Body() dto: PodBodyDto) {
    return this.pods.create(dto);
  }

  @Get()
  findAll(@Query() query: PodsQueryDto) {
    return this.pods.findAll(query);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @Query() query: PodsQueryDto) {
    return this.pods.history(id, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      range: query.range,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pods.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: PodBodyDto) {
    return this.pods.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pods.remove(id);
  }
}
