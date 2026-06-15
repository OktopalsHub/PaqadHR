'use client';

import { format } from 'date-fns';
import {
  BarChart3,
  Calendar as CalendarIcon,
  Download,
  FileText,
  Filter,
  PieChart,
  Send,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { ContentCard } from '@/components/content-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ReportsGenerator() {
  const [selectedReport, setSelectedReport] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [department, setDepartment] = useState('');

  const reportTypes = [
    { id: 'payroll', name: 'Payroll Report', icon: BarChart3 },
    { id: 'attendance', name: 'Attendance Report', icon: PieChart },
    { id: 'performance', name: 'Performance Report', icon: TrendingUp },
    { id: 'employee', name: 'Employee Report', icon: FileText },
  ];

  const recentReports = [
    {
      id: 1,
      name: 'Monthly Payroll - March 2024',
      type: 'payroll',
      generatedAt: '2024-03-01',
      status: 'completed',
    },
    {
      id: 2,
      name: 'Q1 Performance Review',
      type: 'performance',
      generatedAt: '2024-02-28',
      status: 'completed',
    },
    {
      id: 3,
      name: 'Weekly Attendance Summary',
      type: 'attendance',
      generatedAt: '2024-02-25',
      status: 'processing',
    },
  ];

  const handleGenerateReport = () => {
    console.log('Generating report:', {
      type: selectedReport,
      department,
      dateRange,
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ContentCard title="Generate report" description="Configure and export">
        <div className="space-y-4">
          <div>
            <Label>Report type</Label>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <type.icon className="size-4" />
                      {type.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date range</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 size-4" />
                    {dateRange.from ? format(dateRange.from, 'PPP') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 size-4" />
                    {dateRange.to ? format(dateRange.to, 'PPP') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateReport} className="flex-1">
              <BarChart3 className="mr-2 size-4" />
              Generate report
            </Button>
            <Button variant="outline" size="icon">
              <Filter className="size-4" />
            </Button>
          </div>
        </div>
      </ContentCard>

      <ContentCard title="Recent reports" description="Download or share exports">
        <div className="space-y-3">
          {recentReports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium">{report.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Generated on {format(new Date(report.generatedAt), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                  {report.status}
                </Badge>
                {report.status === 'completed' ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Download className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Send className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </ContentCard>
    </div>
  );
}
