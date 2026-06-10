import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(dto: CreateTenantDto) {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug }, { email: dto.email }] },
    });

    if (existing) {
      throw new ConflictException(
        'Tenant with this slug or email already exists',
      );
    }

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        email: dto.email,
        slug,
      },
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
