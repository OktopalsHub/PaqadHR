import { Module } from '@nestjs/common';
import { PaymentsModule } from 'src/common/providers/payments.module';

@Module({
  imports: [PaymentsModule],
  exports: [PaymentsModule],
})
export class WebhooksModule {}
