import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Res,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ImportExportService, ColumnMapping, ImportResult } from './import-export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectEditorGuard } from '../../common/guards/project-editor.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard, ProjectEditorGuard)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Get(':projectId/export/csv')
  async exportCsv(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const csvContent = await this.importExportService.exportToCsv(projectId);
    const filename = `project_${projectId}_tasks_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(csvContent);
  }

  @Get(':projectId/export/json')
  async exportJson(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const jsonData = await this.importExportService.exportToJson(projectId);
    const filename = `project_${projectId}_snapshot_${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).json(jsonData);
  }

  @Post(':projectId/import/csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('columnMapping') columnMapping?: string,
  ): Promise<{ files: string[]; result: ImportResult }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const content = file.buffer.toString('utf-8');
    let parsedMapping: ColumnMapping | undefined;

    if (columnMapping) {
      try {
        parsedMapping = JSON.parse(columnMapping);
      } catch {
        throw new BadRequestException('Invalid columnMapping JSON');
      }
    }

    const result = await this.importExportService.importFromCsv(
      projectId,
      content,
      parsedMapping,
    );

    return {
      files: [file.originalname],
      result,
    };
  }

  @Post(':projectId/import/json')
  async importJson(
    @Param('projectId') projectId: string,
    @Body() body: any,
  ): Promise<{ files: string[]; result: ImportResult }> {
    if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
      throw new BadRequestException('Invalid JSON data');
    }

    let jsonData = body;
    if (body.data) {
      jsonData = body.data;
    }

    const result = await this.importExportService.importFromJson(projectId, jsonData);

    return {
      files: ['inline_json'],
      result,
    };
  }
}
