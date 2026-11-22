import { Repository } from 'typeorm';

import { EmergencyContactRepository } from './emergency-contact.repository';
import type { EmergencyContact } from './entities/emergency-contact.entity';

describe('EmergencyContactRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  it('createEmergencyContact persists the built entity and returns the saved one', async () => {
    const base = {
      target: Object,
      manager: {},
      queryRunner: undefined,
    } as unknown as Repository<EmergencyContact>;
    const repo = new EmergencyContactRepository(base);
    const built = {
      name: 'Ann',
      tenantId: 't',
      tenantMemberId: 'm',
    } as unknown as EmergencyContact;
    const saved = { ...built, id: 'c1' } as EmergencyContact;
    const create = jest.spyOn(Repository.prototype, 'create').mockReturnValue(built as never);
    const save = jest.spyOn(repo, 'save').mockResolvedValue(saved as never);

    const result = await repo.createEmergencyContact({ name: 'Ann' } as never, 't', 'm');

    expect(create).toHaveBeenCalledWith({ name: 'Ann', tenantId: 't', tenantMemberId: 'm' });
    expect(save).toHaveBeenCalledWith(built);
    expect(result).toBe(saved);
  });

  it('unsets the existing primary before saving a new primary contact', async () => {
    const base = {
      target: Object,
      manager: {},
      queryRunner: undefined,
    } as unknown as Repository<EmergencyContact>;
    const repo = new EmergencyContactRepository(base);
    const order: string[] = [];
    jest.spyOn(Repository.prototype, 'create').mockReturnValue({} as never);
    jest.spyOn(repo, 'find').mockResolvedValue([{ id: 'old' }] as never);
    jest.spyOn(repo, 'update').mockImplementation((async () => {
      order.push('update');
    }) as never);
    jest.spyOn(repo, 'save').mockImplementation((async () => {
      order.push('save');
      return {};
    }) as never);

    await repo.createEmergencyContact({ isPrimary: true } as never, 't', 'm');

    expect(order).toEqual(['update', 'save']);
  });
});
