import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Gift, User, Clock } from "lucide-react";

export const UpcomingReminders = () => {
  const reminders = [
    {
      type: "birthday",
      title: "Sarah Johnson's Birthday",
      date: "Tomorrow",
      icon: <Gift className="w-4 h-4" />,
      color: "bg-pink-500",
    },
    {
      type: "anniversary",
      title: "Mike Chen - 2 Year Anniversary",
      date: "March 15",
      icon: <Calendar className="w-4 h-4" />,
      color: "bg-purple-500",
    },
    {
      type: "review",
      title: "Performance Review - Lisa R.",
      date: "March 18",
      icon: <User className="w-4 h-4" />,
      color: "bg-blue-500",
    },
    {
      type: "probation",
      title: "End of Probation - Tom B.",
      date: "March 20",
      icon: <Clock className="w-4 h-4" />,
      color: "bg-orange-500",
    },
  ];

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">📌</span>
          Upcoming Reminders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reminders.map((reminder, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div
                className={`w-8 h-8 ${reminder.color} rounded-full flex items-center justify-center text-white`}
              >
                {reminder.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-700 text-sm">
                  {reminder.title}
                </p>
                <p className="text-xs text-slate-500">{reminder.date}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {reminder.type}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
