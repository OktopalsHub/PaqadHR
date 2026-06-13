"use client";

import { ThemeSwitcher } from "./theme-switcher";
import { useAuth } from "@/hooks/use-auth";
import { AccountSetting } from "./account-setting";
import type { User } from "@/types";

export const AppTopBar = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-14 items-center justify-end gap-2 px-4">
      <ThemeSwitcher />
      <AccountSetting user={user as User} logout={logout} />
    </div>
  );
};
