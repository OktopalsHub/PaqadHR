export class TenantCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly tenantMemberId: string,
    public readonly tenantData: unknown,
  ) {}
}
export class TenantMemberCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly memberId: string,
    public readonly joinDate: Date,
  ) {}
}

export class TenantMemberChangedEvent {
  constructor(public readonly tenantId: string) {}
}

export class ProfileUpdatedEvent {
  constructor(
    public readonly recipientId: string,
    public readonly tenantId: string,
    public readonly variables: {
      updatedFields: string[];
      updatedBy: string;
    },
  ) {}
}
export class LeaveTypeCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly leaveTypeId: string,
    public readonly defaultDays: number,
  ) {}
}
