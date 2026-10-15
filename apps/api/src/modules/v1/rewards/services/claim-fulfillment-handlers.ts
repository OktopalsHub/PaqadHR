import { Logger } from '@nestjs/common';
import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { resolveNgRewardsAirtimeProvider } from 'src/common/utils/ng-money-provider.util';
import { DataSource } from 'typeorm';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { CustomReward } from '../entities/custom-reward.entity';
import { RedemptionStatus, RewardRedemption } from '../entities/reward-redemption.entity';
import type { ClaimInput } from './claim-verification.service';
import { RewardsCatalogService } from './rewards-catalog.service';

const logger = new Logger('ClaimFulfillmentHandlers');

function useMonnifyNgBills(): boolean {
  return resolveNgRewardsAirtimeProvider() === PaymentProvider.MONNIFY;
}

export async function fulfillTremendous(
  dataSource: DataSource,
  tremendousApi: TremendousApiService,
  catalogService: RewardsCatalogService,
  emailTemplateService: EmailTemplateService,
  emailService: ZeptomailEmailService,
  redemption: RewardRedemption,
  input: ClaimInput,
): Promise<void> {
  const productId = catalogService.extractTremendousProductId(input.rewardId);
  if (!productId) throw new Error('Missing Tremendous productId for gift card order');
  const member = await dataSource
    .getRepository(TenantMember)
    .createQueryBuilder('m')
    .leftJoin('m.user', 'u')
    .select(['m.id', 'm.firstName', 'm.lastName', 'm.preferredName', 'u.id', 'u.email'])
    .where('m.id = :id AND m.tenantId = :tenantId', {
      id: redemption.memberId,
      tenantId: redemption.tenantId,
    })
    .getOne();
  const recipientEmail = redemption.recipient?.email ?? member?.user?.email;
  if (!recipientEmail) throw new Error('Recipient email is required to issue a Tremendous reward');
  const recipientName =
    member?.preferredName?.trim() ||
    `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() ||
    'Member';
  const orderResponse = await tremendousApi.createOrder({
    productId,
    denomination: Number(redemption.currencyValue),
    currencyCode: redemption.currencyCode,
    recipientName,
    recipientEmail,
    externalId: redemption.id,
  });
  const orderStatus = orderResponse.order?.status;
  const reward = orderResponse.reward ?? orderResponse.order?.rewards?.[0];
  const deliveryStatus = reward?.delivery?.status;
  const deliveryLink = reward?.delivery?.link ?? null;
  const orderId = orderResponse.order?.id ?? reward?.id ?? null;
  if (
    orderStatus === 'DECLINED' ||
    orderStatus === 'CANCELLED' ||
    deliveryStatus === 'FAILED' ||
    deliveryStatus === 'BOUNCED'
  )
    throw new Error(
      `Tremendous order was not fulfilled: ${orderStatus ?? deliveryStatus ?? 'unknown status'}`,
    );
  await dataSource.getRepository(RewardRedemption).update(redemption.id, {
    status: 'SUCCESS' as RedemptionStatus,
    providerRef: { ...redemption.providerRef, txRef: orderId ?? undefined },
    voucher: {
      code: deliveryLink ?? undefined,
      instructions: deliveryLink
        ? 'Open this link to choose and redeem your gift card.'
        : 'Your reward is being prepared. Check back shortly for your redemption link.',
    },
    processingStartedAt: null,
  });
  if (deliveryLink) {
    const rendered = emailTemplateService.render('reward-claim', {
      employeeName: recipientName,
      employeeEmail: recipientEmail,
      rewardName: redemption.rewardName ?? 'Gift Card',
      rewardAmount: redemption.currencyValue,
      currencyCode: redemption.currencyCode,
      redemptionUrl: deliveryLink,
      referenceId: redemption.id,
      providerName: 'Tremendous',
      providerLogoUrl: 'https://www.tremendous.com/img/tremendous-logo.png',
    });
    void emailService
      .sendEmail({
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
      .catch((err) =>
        logger.warn(
          `Failed to send reward claim email: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }
}

export async function fulfillNombaTopup(
  dataSource: DataSource,
  nombaBillApi: NombaBillApiService,
  monnifyBillApi: MonnifyBillApiService,
  redemption: RewardRedemption,
  input: ClaimInput,
): Promise<void> {
  if (!input.recipientPhone || !input.airtimeNetwork)
    throw new Error('Phone number and network are required for mobile top-up');
  const isData = input.topupKind === 'data';
  let result: { success: boolean; transactionId: string | null; status: string };
  if (useMonnifyNgBills()) {
    result = isData
      ? await monnifyBillApi.purchaseDataBundle({
          amount: redemption.currencyValue,
          phoneNumber: input.recipientPhone,
          network: input.airtimeNetwork,
          merchantTxRef: redemption.id,
          dataPlanCode: input.dataPlanCode,
        })
      : await monnifyBillApi.purchaseAirtime({
          amount: redemption.currencyValue,
          phoneNumber: input.recipientPhone,
          network: input.airtimeNetwork,
          merchantTxRef: redemption.id,
        });
  } else {
    const tenant = await dataSource
      .getRepository(Tenant)
      .findOne({ where: { id: redemption.tenantId }, select: { name: true } });
    const senderName = formatNombaSenderName(tenant?.name);
    result = isData
      ? await nombaBillApi.purchaseDataBundle({
          amount: redemption.currencyValue,
          phoneNumber: input.recipientPhone,
          network: input.airtimeNetwork,
          merchantTxRef: redemption.id,
          senderName,
        })
      : await nombaBillApi.purchaseAirtime({
          amount: redemption.currencyValue,
          phoneNumber: input.recipientPhone,
          network: input.airtimeNetwork,
          merchantTxRef: redemption.id,
          senderName,
        });
  }
  const kind = isData ? 'data bundle' : 'airtime';
  if (result.success) {
    await dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: {
        instructions: `${isData ? 'Data bundle' : 'Airtime'} of ${redemption.currencyCode} ${redemption.currencyValue} sent to ${input.recipientPhone}`,
      },
      processingStartedAt: null,
    });
    return;
  }
  if (result.status !== 'PENDING')
    throw new Error(`${kind} purchase failed: status ${result.status}`);
  await dataSource.getRepository(RewardRedemption).update(redemption.id, {
    status: 'PROCESSING' as RedemptionStatus,
    providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
    voucher: { instructions: `Your ${kind} is being confirmed with the network.` },
    processingStartedAt: () => 'NOW()',
  });
}

export async function fulfillNombaUtility(
  dataSource: DataSource,
  nombaBillApi: NombaBillApiService,
  monnifyBillApi: MonnifyBillApiService,
  redemption: RewardRedemption,
  input: ClaimInput,
): Promise<void> {
  if (!input.accountNumber || !input.billerId || !input.serviceType)
    throw new Error('Meter number, biller ID, and service type are required');
  const purchaseInput = {
    amount: redemption.currencyValue,
    meterNumber: input.accountNumber,
    billerId: String(input.billerId),
    serviceType: input.serviceType as 'PREPAID' | 'POSTPAID',
    merchantTxRef: redemption.id,
  };
  const result = useMonnifyNgBills()
    ? await monnifyBillApi.purchaseElectricity(purchaseInput)
    : await nombaBillApi.purchaseElectricity(purchaseInput);
  if (result.success) {
    await dataSource.getRepository(RewardRedemption).update(redemption.id, {
      status: 'SUCCESS' as RedemptionStatus,
      providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
      voucher: {
        code: result.token || undefined,
        instructions: result.token
          ? `Utility payment successful. Prepaid token: ${result.token}`
          : `Utility payment successful. Reference: ${result.transactionId}`,
      },
      processingStartedAt: null,
    });
    return;
  }
  if (result.status !== 'PENDING')
    throw new Error(`Electricity purchase failed: status ${result.status}`);
  await dataSource.getRepository(RewardRedemption).update(redemption.id, {
    status: 'PROCESSING' as RedemptionStatus,
    providerRef: { ...redemption.providerRef, txRef: result.transactionId ?? undefined },
    voucher: { instructions: 'Your utility payment is being confirmed with the provider.' },
    processingStartedAt: () => 'NOW()',
  });
}

export async function fulfillCustom(
  dataSource: DataSource,
  redemption: RewardRedemption,
): Promise<void> {
  const customReward = await dataSource
    .getRepository(CustomReward)
    .findOne({ where: { id: redemption.rewardId ?? undefined } });
  await dataSource.getRepository(RewardRedemption).update(redemption.id, {
    status: 'SUCCESS' as RedemptionStatus,
    voucher: {
      instructions:
        customReward?.deliveryInstructions ??
        'Your admin has been notified and will fulfill this reward.',
    },
    processingStartedAt: null,
  });
}
