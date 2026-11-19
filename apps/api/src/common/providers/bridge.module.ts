import { Module } from '@nestjs/common';

import { BridgeApiService } from '../services/bridge-api.service';

@Module({
  providers: [BridgeApiService],
  exports: [BridgeApiService],
})
export class BridgeModule {}
