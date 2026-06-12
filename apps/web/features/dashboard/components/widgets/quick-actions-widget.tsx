import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, CheckCircle, Megaphone, DollarSign } from "lucide-react";

export const QuickActionsWidget = () => {
  const actions = [
    {
      icon: <UserPlus className="w-5 h-5" />,
      label: "Add Employee",
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      label: "Approve Leave",
      color: "from-green-500 to-green-600",
    },
    {
      icon: <Megaphone className="w-5 h-5" />,
      label: "Announcement",
      color: "from-purple-500 to-purple-600",
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      label: "Run Payroll",
      color: "from-emerald-500 to-emerald-600",
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              className={`bg-gradient-to-r ${action.color} text-white h-16 flex flex-col items-center gap-2 hover:scale-105 transition-transform`}
            >
              {action.icon}
              <span className="text-sm">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
