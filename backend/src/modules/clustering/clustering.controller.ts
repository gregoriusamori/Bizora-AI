import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ValidationPipe } from '@nestjs/common';
import { ClusteringService } from './clustering.service.js';
import { SegmentationService } from './segmentation.service.js';
import { PrismaService } from '../../common/prisma.service.js';
import { RunClusteringDto, RunSegmentationDto } from './dto/clustering.dto.js';

@Controller('clustering')
@UseGuards(AuthGuard('jwt'))
export class ClusteringController {
  constructor(
    private readonly clusteringService: ClusteringService,
    private readonly segmentationService: SegmentationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run')
  async run(@Body(new ValidationPipe()) dto: RunClusteringDto) {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: dto.datasetId },
    });
    if (!dataset) {
      throw new Error('Dataset not found');
    }
    const data = await this.prisma.datasetData.findMany({
      where: { datasetId: dto.datasetId },
    });
    const rows = data.map((d) => d.rowData as Record<string, unknown>);

    const columns = [dto.featureColumn, dto.secondFeatureColumn].filter(
      (c): c is string => Boolean(c),
    );
    const matrix = rows
      .map((row) => columns.map((c) => Number(row[c])))
      .filter((point) => point.every((v) => Number.isFinite(v)));

    if (matrix.length === 0) {
      return {
        adequate: false,
        message: 'Tidak ada nilai numerik yang valid pada kolom yang dipilih.',
        clusters: dto.clusters,
        assignments: [],
        centroids: [],
        clusterSizes: [],
        inertia: null,
      };
    }

    const standardized = this.clusteringService.standardize(matrix);
    const result = this.clusteringService.kMeans(standardized, dto.clusters);

    return {
      adequate: true,
      columns,
      clusters: dto.clusters,
      dataPoints: matrix.length,
      assignments: result.assignments,
      centroids: result.centroids,
      clusterSizes: result.clusterSizes,
      inertia: result.inertia,
      iterations: result.iterations,
      note: 'Fitur distandarisasi (z-score) sebelum clustering. Centroid berada pada skala standarisasi.',
    };
  }

  @Post('segmentation')
  async segmentation(@Body(new ValidationPipe()) dto: RunSegmentationDto) {
    return this.segmentationService.runSegmentation(dto);
  }
}
