import { CreateTaskDto, SubmitTaskDto, UpdateTaskDto } from './task.dto';
import { failedProperties, validationErrors } from './validate-dto.testing';

const valid = {
  title: 'Refer a friend',
  description: 'Bring someone in',
  points: 15,
  icon: 'star',
  submissionType: 'text',
};

describe('CreateTaskDto', () => {
  it('accepts a valid task', () => {
    expect(validationErrors(CreateTaskDto, { ...valid, isRecurring: true })).toHaveLength(0);
  });

  it('rejects unknown fields', () => {
    expect(failedProperties(CreateTaskDto, { ...valid, tenantId: 'x' })).toContain('tenantId');
  });

  it.each([0, -5, Number.NaN, 1.5, '5', 1e9])('rejects points %p', (points) => {
    expect(failedProperties(CreateTaskDto, { ...valid, points })).toContain('points');
  });

  it('rejects a bad submissionType and long title', () => {
    expect(
      failedProperties(CreateTaskDto, {
        ...valid,
        submissionType: 'x',
        title: 'a'.repeat(300),
      }),
    ).toEqual(expect.arrayContaining(['submissionType', 'title']));
  });
});

describe('UpdateTaskDto', () => {
  it('accepts a partial update', () => {
    expect(validationErrors(UpdateTaskDto, { points: 20 })).toHaveLength(0);
  });

  it('rejects unknown fields and negative points', () => {
    expect(failedProperties(UpdateTaskDto, { id: 'x', points: -1 })).toEqual(
      expect.arrayContaining(['id', 'points']),
    );
  });
});

describe('SubmitTaskDto', () => {
  it('accepts an empty body and text', () => {
    expect(validationErrors(SubmitTaskDto, {})).toHaveLength(0);
    expect(validationErrors(SubmitTaskDto, { submissionText: 'done' })).toHaveLength(0);
  });

  it('rejects unknown, non-string and oversized values', () => {
    expect(
      failedProperties(SubmitTaskDto, {
        status: 'completed',
        submissionText: 5,
        submissionFileName: 'a'.repeat(500),
      }),
    ).toEqual(expect.arrayContaining(['status', 'submissionText', 'submissionFileName']));
  });
});
