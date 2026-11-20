'use client';

import { useSyncExternalStore } from 'react';

import {
  readAskEmailOnMove,
  subscribeAskEmailOnMove,
  writeAskEmailOnMove,
} from '../lib/email-on-move-preference';

export function useAskEmailOnMove(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribeAskEmailOnMove, readAskEmailOnMove, () => true);
  return [value, writeAskEmailOnMove];
}
