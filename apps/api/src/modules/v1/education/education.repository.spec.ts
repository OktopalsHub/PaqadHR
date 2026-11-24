import { Repository } from 'typeorm';

import { EducationRepository } from './education.repository';
import type { Education } from './entities/education.entity';

describe('EducationRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  it('createEducation persists the built entity and returns the saved one', async () => {
    const base = {
      target: Object,
      manager: {},
      queryRunner: undefined,
    } as unknown as Repository<Education>;
    const repo = new EducationRepository(base);
    const built = { title: 'BSc', tenantId: 't', tenantMemberId: 'm' } as Education;
    const saved = { ...built, id: 'e1' } as Education;
    const create = jest.spyOn(Repository.prototype, 'create').mockReturnValue(built as never);
    const save = jest.spyOn(repo, 'save').mockResolvedValue(saved as never);

    const result = await repo.createEducation({ title: 'BSc' } as never, 't', 'm');

    expect(create).toHaveBeenCalledWith({ title: 'BSc', tenantId: 't', tenantMemberId: 'm' });
    expect(save).toHaveBeenCalledWith(built);
    expect(result).toBe(saved);
  });
});
