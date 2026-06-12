import { Module } from '@nestjs/common';
import { NombaProvider } from 'src/common/providers/nomba.provider';
@Module({
  providers: [NombaProvider],
})
export class WebhooksModule {}
