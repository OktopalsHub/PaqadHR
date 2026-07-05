import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@slack/web-api';
import { ChannelManagementService } from './channel-management.service';

const mockList = jest.fn();
const mockJoin = jest.fn();

function slackPlatformError(error: string, needed?: string) {
  return {
    code: ErrorCode.PlatformError,
    data: { ok: false, error, ...(needed ? { needed } : {}) },
  };
}

jest.mock('../clients/slack.client', () => ({
  SlackClient: jest.fn().mockImplementation(() => ({
    client: {
      conversations: {
        list: mockList,
        join: mockJoin,
      },
    },
  })),
}));

describe('ChannelManagementService.getAvailableChannels', () => {
  const integrationId = 'integration-1';
  const integrationRepo = { findOne: jest.fn() };
  const channelRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const createService = () =>
    new ChannelManagementService(channelRepo as any, integrationRepo as any);

  beforeEach(() => {
    jest.clearAllMocks();
    integrationRepo.findOne.mockResolvedValue({
      id: integrationId,
      type: 'slack',
      botToken: 'xoxb-test',
    });
    mockJoin.mockResolvedValue({ ok: true });
  });

  it('maps Slack platform auth errors to BadRequestException', async () => {
    mockList.mockRejectedValue(slackPlatformError('invalid_auth'));

    await expect(createService().getAvailableChannels(integrationId)).rejects.toThrow(
      new BadRequestException('Slack authorization failed (invalid_auth). Reconnect Slack.'),
    );
  });

  it('includes needed scope in missing_scope reconnect message', async () => {
    mockList.mockRejectedValue(slackPlatformError('missing_scope', 'groups:read'));

    await expect(createService().getAvailableChannels(integrationId)).rejects.toThrow(
      new BadRequestException(
        'Slack authorization failed (missing_scope: groups:read). Reconnect Slack.',
      ),
    );
  });

  it('maps other Slack platform errors to BadRequestException', async () => {
    mockList.mockRejectedValue(slackPlatformError('channel_not_found'));

    await expect(createService().getAvailableChannels(integrationId)).rejects.toThrow(
      new BadRequestException('Slack could not list channels: channel_not_found'),
    );
  });

  it('paginates conversations.list until cursor is empty', async () => {
    mockList
      .mockResolvedValueOnce({
        ok: true,
        channels: [{ id: 'C1', name: 'general', is_private: false }],
        response_metadata: { next_cursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        ok: true,
        channels: [{ id: 'C2', name: 'random', is_private: false }],
        response_metadata: { next_cursor: '' },
      });

    const channels = await createService().getAvailableChannels(integrationId);

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList.mock.calls[1][0]).toMatchObject({ cursor: 'cursor-1' });
    expect(channels).toEqual([
      { id: 'C1', name: 'general', type: 'public', memberCount: undefined, description: undefined },
      { id: 'C2', name: 'random', type: 'public', memberCount: undefined, description: undefined },
    ]);
  });

  it('requires bot token before calling Slack', async () => {
    integrationRepo.findOne.mockResolvedValue({
      id: integrationId,
      type: 'slack',
      botToken: '',
    });

    await expect(createService().getAvailableChannels(integrationId)).rejects.toThrow(
      new BadRequestException('Slack bot token is missing. Reconnect Slack.'),
    );
    expect(mockList).not.toHaveBeenCalled();
  });
});
