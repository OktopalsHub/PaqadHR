import { NotificationChannel } from "../enums/notification-channel.enum";

export interface UpdatePreferenceDto {
    preferredChannel?: NotificationChannel;
    isEnabled?: boolean;
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    quietDays?: string[];
}
