import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

// JwtModule is NOT imported here — it's registered with `global: true` in
// AppModule, so JwtService is already injectable anywhere in the app
// without a per-module import. TeamService's constructor injection of
// JwtService works as-is. Re-registering it here would be redundant and
// risks confusion about which JWT config (secret/expiry) actually wins.

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
