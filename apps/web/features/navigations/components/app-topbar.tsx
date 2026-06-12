"use client";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Clock, Menu, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ThemeSwitcher } from "./theme-switcher";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { AccountSetting } from "./account-setting";
import { User } from "@/types";
import { ToastMessage } from "@/components/toast-message";
import { toast } from "sonner";

export const AppTopBar = () => {
  const { user, logout } = useAuth();
  const [isClockedIn, setIsClockedIn] = useState(false);

  const handleClockIn = () => {
    setIsClockedIn(true);
    toast.info(
      <ToastMessage
        title="Clocked In"
        description={`You clocked in at ${new Date().toLocaleTimeString()}`}
      />,
    );
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    toast.info(
      <ToastMessage
        title="Clocked Out"
        description={`You clocked out at ${new Date().toLocaleTimeString()}`}
      />,
    );
  };
  return (
    <div className="flex items-center justify-between gap-2 px-4 w-full">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden hover:bg-accent/50 rounded-xl"
        >
          <Menu size={20} />
        </Button>
        <div className="relative max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search anything..."
            className="pl-10 bg-background/50 backdrop-blur-sm border-border/50 rounded-xl focus:bg-background/80 w-[200px] lg:w-[350px] transition-all duration-200"
          />
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-1">
          {!isClockedIn ? (
            <Button
              onClick={handleClockIn}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              size="sm"
            >
              <Clock size={16} />
              <span className="hidden sm:inline ml-1">Clock In</span>
            </Button>
          ) : (
            <Button
              onClick={handleClockOut}
              className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              size="sm"
            >
              <Clock size={16} />
              <span className="hidden sm:inline ml-1">Clock Out</span>
            </Button>
          )}

          {isClockedIn && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 rounded-full">
              On Duty
            </Badge>
          )}
        </div>
        <ThemeSwitcher />
        <AccountSetting user={user as User} logout={logout} />
      </div>
    </div>
  );
};
