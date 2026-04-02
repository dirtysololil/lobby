import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [InvitesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
