import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@slack/web-api';
import { ChannelType } from 'src/common/enums';
import { ChannelManagementService } from './channel-management.service';

const mockList = jest.fn();
const mockJoin = jest.fn();
const mockPostMessage = jest.fn();

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
    sendMessage: mockPostMessage,
  })),
}));

describe('ChannelManagementService', () => {
  const integrationId = 'integration-1';
  const integrationRepo = { findOne: jest.fn() };
  const channelRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
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
    mockPostMessage.mockResolvedValue({ ok: true });
    channelRepo.update.mockResolvedValue(undefined);
    channelRepo.findOne.mockResolvedValue(null);
    channelRepo.create.mockImplementation(async (data) => ({
      id: `ch-${data.platformChannelId}`,
      ...data,
    }));
    channelRepo.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      }),
    });
  });

  describe('getAvailableChannels', () => {
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
        {
          id: 'C1',
          name: 'general',
          type: 'public',
          memberCount: undefined,
          description: undefined,
        },
        {
          id: 'C2',
          name: 'random',
          type: 'public',
          memberCount: undefined,
          description: undefined,
        },
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

  describe('configureShoutoutChannel', () => {
    it('maps not_in_channel to a friendly invite message', async () => {
      mockPostMessage.mockRejectedValue(slackPlatformError('not_in_channel'));

      const result = await createService().configureShoutoutChannel(
        integrationId,
        'C123',
        'shoutouts',
        'member-1',
      );

      expect(mockJoin).toHaveBeenCalledWith({ channel: 'C123' });
      expect(result.testMessageSent).toBe(false);
      expect(result.needsInvite).toBe(true);
      expect(result.testMessageError).toContain("can't post to #shoutouts");
      expect(result.testMessageError).toContain('/invite @PaqadHR');
    });
  });

  describe('configureShoutoutChannels', () => {
    it('saves all selected channels and deactivates removed ones', async () => {
      const result = await createService().configureShoutoutChannels(
        integrationId,
        [
          { platformChannelId: 'C1', platformChannelName: 'general' },
          { platformChannelId: 'C2', platformChannelName: 'shoutouts' },
        ],
        'member-1',
      );

      expect(channelRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId,
          channelType: ChannelType.SHOUTOUTS,
          isActive: true,
        }),
        { isActive: false, isPrimary: false },
      );
      expect(channelRepo.create).toHaveBeenCalledTimes(2);
      expect(result.channels).toHaveLength(2);
      expect(result.allTestsPassed).toBe(true);
      expect(result.inviteRequired).toEqual([]);
    });

    it('collects inviteRequired when test messages fail with not_in_channel', async () => {
      mockPostMessage
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(slackPlatformError('not_in_channel'));

      const result = await createService().configureShoutoutChannels(
        integrationId,
        [
          { platformChannelId: 'C1', platformChannelName: 'general' },
          { platformChannelId: 'C2', platformChannelName: 'private-room' },
        ],
        'member-1',
      );

      expect(result.allTestsPassed).toBe(false);
      expect(result.inviteRequired).toEqual(['#private-room']);
      expect(result.channels[1]?.needsInvite).toBe(true);
    });
  });
});
