import { EmploymentRepository } from './employment.repository';

describe('EmploymentRepository.replaceCurrentEmployment', () => {
  it('locks the member, then ends the open row and inserts the next one in one transaction', async () => {
    const calls: string[] = [];
    const open = { id: 'old', endDate: null };
    const txRepo = {
      findOne: jest.fn().mockImplementation(async () => {
        calls.push('find');
        return open;
      }),
      save: jest.fn().mockImplementation(async (row: unknown) => {
        calls.push('save');
        return row;
      }),
      create: jest.fn().mockImplementation((row: unknown) => row),
    };
    const manager = {
      query: jest.fn().mockImplementation(async () => {
        calls.push('lock');
      }),
      getRepository: jest.fn().mockReturnValue(txRepo),
    };
    const transaction = jest
      .fn()
      .mockImplementation((work: (m: unknown) => unknown) => work(manager));
    const base = { target: class {}, manager: { transaction }, queryRunner: undefined };
    const repository = new EmploymentRepository(base as never);

    const endDate = new Date('2024-05-31');
    await repository.replaceCurrentEmployment('tenant-1', 'member-1', () => ({
      endDate,
      next: { payRate: 5 },
    }));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['lock', 'find', 'save', 'save']);
    expect(manager.query.mock.calls[0][1]).toEqual(['member-1']);
    expect(open).toMatchObject({ endDate });
  });
});
