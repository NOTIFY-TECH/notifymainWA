import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignTemplateDto } from './dto/create-campaign-template.dto';
import { UpdateCampaignTemplateDto } from './dto/update-campaign-template.dto';

@Injectable()
export class CampaignTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Private helpers ──────────────────────────────────────────────────────

  private async findOrThrow(tenantId: string, templateId: string) {
    const template = await this.prisma.campaignTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Campaign template not found.');
    return template;
  }

  // ── Public methods ───────────────────────────────────────────────────────

  async list(tenantId: string) {
    const templates = await this.prisma.campaignTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: templates, success: true };
  }

  async create(tenantId: string, dto: CreateCampaignTemplateDto) {
    const template = await this.prisma.campaignTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        messageBody: dto.messageBody,
        mediaUrl: dto.mediaUrl ?? null,
        mediaType: dto.mediaType ?? null,
      },
    });
    return { data: template, success: true };
  }

  async update(
    tenantId: string,
    templateId: string,
    dto: UpdateCampaignTemplateDto,
  ) {
    await this.findOrThrow(tenantId, templateId);
    const updated = await this.prisma.campaignTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.messageBody !== undefined && { messageBody: dto.messageBody }),
        // null = explicitly clear; undefined = don't touch
        ...(dto.mediaUrl !== undefined && { mediaUrl: dto.mediaUrl }),
        ...(dto.mediaType !== undefined && { mediaType: dto.mediaType }),
      },
    });
    return { data: updated, success: true };
  }

  async remove(tenantId: string, templateId: string) {
    await this.findOrThrow(tenantId, templateId);
    await this.prisma.campaignTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }
}
