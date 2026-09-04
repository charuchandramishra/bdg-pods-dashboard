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
  IsOptional,
  IsString,
  Min,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BdgService, BdgUpsertDto } from './bdg.service';

class BdgQueryDto {
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
  member?: string;

  @IsOptional()
  @IsString()
  members?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  periodStart?: string;

  @IsOptional()
  @IsString()
  periodEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  format?: 'csv' | 'xlsx';
}

class BdgBodyDto implements BdgUpsertDto {
  @IsString()
  memberName!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  totalInbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  totalOutbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  apacInbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  apacOutbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  menaInbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  menaOutbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  internationalInbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  internationalOutbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  ukeuInbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  ukeuOutbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  naInbound?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  naOutbound?: number | null;

  @IsOptional()
  @IsString()
  periodStart?: string | null;

  @IsOptional()
  @IsString()
  periodEnd?: string | null;
}

@Controller('bdg')
export class BdgController {
  constructor(private readonly bdg: BdgService) {}

  @Get('summary')
  summary() {
    return this.bdg.summary();
  }

  @Get('by-region')
  byRegion(@Query() query: BdgQueryDto) {
    return this.bdg.byRegion(query);
  }

  @Get('top-members')
  topMembers(@Query() query: BdgQueryDto) {
    return this.bdg.topMembers(query.limit ?? 10, query);
  }

  @Get('export')
  async export(@Query() query: BdgQueryDto, @Res() res: Response) {
    const rows = await this.bdg.exportAll(query);
    if (query.format === 'xlsx') {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'BDG');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="bdg-export.xlsx"');
      return res.send(buf);
    }

    const headers = [
      'memberName',
      'totalInbound',
      'totalOutbound',
      'totalLeads',
      'apacTotal',
      'menaTotal',
      'internationalTotal',
      'ukeuTotal',
      'naTotal',
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
    res.setHeader('Content-Disposition', 'attachment; filename="bdg-export.csv"');
    return res.send(csv);
  }

  @Post()
  create(@Body() dto: BdgBodyDto) {
    return this.bdg.create(dto);
  }

  @Get()
  findAll(@Query() query: BdgQueryDto) {
    return this.bdg.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bdg.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: BdgBodyDto) {
    return this.bdg.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bdg.remove(id);
  }
}
