import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Network } from "lucide-react";
import type { Department } from "@/lib/schemas/department";

interface OrgNode {
  name: string;
  role: string;
  children?: OrgNode[];
}

function buildOrgChart(departments: Department[]): OrgNode {
  return {
    name: "PaqadHR",
    role: "Organization",
    children: departments
      .filter((dept) => dept.manager)
      .map((dept) => ({
        name: dept.manager!.name,
        role: `${dept.name} Manager`,
        children: dept.members.map((member) => ({
          name: member.name,
          role: member.role ?? member.position ?? "Member",
        })),
      })),
  };
}

function OrgNodeCard({ node, level = 0 }: { node: OrgNode; level?: number }) {
  return (
    <div className={level > 0 ? "ml-8" : ""}>
      <Card className="mb-4 glass-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                {node.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{node.name}</p>
              <p className="text-sm text-muted-foreground">{node.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {node.children && (
        <div className="ml-4 border-l-2 border-gray-200 pl-4">
          {node.children.map((child) => (
            <OrgNodeCard key={child.name} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChartView({ departments }: { departments: Department[] }) {
  const orgChartData = buildOrgChart(departments);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Organization Chart
        </CardTitle>
        <p className="text-muted-foreground">
          Visual representation of your company structure
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[600px]">
          <OrgNodeCard node={orgChartData} />
        </div>
      </CardContent>
    </Card>
  );
}
