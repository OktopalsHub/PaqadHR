import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, CheckCircle, Megaphone, DollarSign } from "lucide-react";

export const QuickActionPanel = () => {
  const quickActions = [
    {
      icon: <UserPlus className="w-5 h-5" />,
      label: "Add Employee",
      color:
        "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      action: () => console.log("Add employee"),
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      label: "Approve Leave",
      color:
        "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
      action: () => console.log("Approve leave"),
    },
    {
      icon: <Megaphone className="w-5 h-5" />,
      label: "Post Announcement",
      color:
        "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
      action: () => console.log("Post announcement"),
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      label: "Run Payroll",
      color:
        "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
      action: () => console.log("Run payroll"),
    },
  ];

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">✅</span>
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.action}
              className={`${action.color} text-white border-0 h-12 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105`}
            >
              {action.icon}
              <span className="hidden sm:inline text-sm font-medium">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
