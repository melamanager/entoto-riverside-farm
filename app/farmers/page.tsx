import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { FARMERS, TASKS, VALVES } from "@/lib/data";
import { Phone, ListTodo, CheckCircle2 } from "lucide-react";

export default function FarmersPage() {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">👥 Farmer Management</h1>
        <p className="text-stone-500 text-sm">Roles, assignments, performance & attendance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FARMERS.map((f) => {
          const farmerTasks = TASKS.filter(t => t.assignedTo === f.id);
          const pending = farmerTasks.filter(t => t.status !== "done").length;
          const done = farmerTasks.filter(t => t.status === "done").length;
          const valves = VALVES.filter(v => f.assignedValves.includes(v.id));
          return (
            <Card key={f.id} className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="size-12 ring-2 ring-emerald-100">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">{f.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{f.name}</div>
                  <Badge variant="outline" className="text-[10px] capitalize mt-0.5">{f.role}</Badge>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-700 tabular-nums">{f.performanceScore}</div>
                  <div className="text-[10px] text-stone-500">perf score</div>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-500">Attendance</span>
                    <span className="font-semibold tabular-nums">{f.attendanceRate}%</span>
                  </div>
                  <Progress value={f.attendanceRate} className="h-1.5" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-2">
                <Phone className="size-3" /> {f.phone}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {valves.map(v => (
                  <Badge key={v.id} variant="secondary" className="text-[10px]" style={{background: `${v.color}20`, color: v.color}}>
                    {v.name}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-3 border-t">
                <div>
                  <div className="text-xs text-stone-500 flex items-center justify-center gap-1"><ListTodo className="size-3" /> Pending</div>
                  <div className="text-base font-bold text-amber-600">{pending}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 flex items-center justify-center gap-1"><CheckCircle2 className="size-3" /> Done</div>
                  <div className="text-base font-bold text-emerald-600">{done}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
