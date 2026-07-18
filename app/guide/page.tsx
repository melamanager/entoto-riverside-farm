"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Sun, Sunset, Bug, Wheat, ShoppingCart, ClipboardCheck,
  CalendarCheck, Droplets, Warehouse, Bell, AlertTriangle, CheckCircle2,
  DollarSign, MessageSquare, Bot,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// Plain-language guide for farm staff — no technical words, follows the real
// working day. Shown to managers and supervisors.

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">{n}</div>
      <div className="pb-4">
        <div className="font-semibold text-sm text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  const { isManager } = useAuth();

  return (
    <div className="p-6 md:p-8 max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">How to Use This System</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          A simple guide for everyone on the farm. No computer knowledge needed — just follow your day.
        </p>
      </div>

      {/* The golden rule */}
      <Card className="p-5 border-amber-300 bg-amber-50/60">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-800">The one rule that matters most</div>
            <p className="text-sm text-amber-700 mt-1 leading-relaxed">
              <b>Write things down the day they happen.</b> The system only knows what you tell it.
              If you harvest and don&apos;t record it, the harvest doesn&apos;t exist. If a supervisor records
              <b> nothing at all</b> in a day (no attendance, no watering, no Day Log note), that day
              <b> does not count as a worked day</b> — unless the manager approves it afterwards.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Supervisor day ── */}
      <Card className="p-6">
        <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
          <Sun className="size-5 text-amber-500" /> A Supervisor&apos;s Day
        </h2>
        <p className="text-xs text-muted-foreground mb-5">Follow these steps every working day.</p>

        <Step n={1} title="Morning — open Daily Routines">
          Tap <b>Daily Routines</b> in the menu. This checklist IS your day: 8 boxes that should
          all be green by evening. Read the <b>Day Log</b> on the right — the manager posts the
          day&apos;s instructions there.
        </Step>
        <Step n={2} title="Take attendance (before 6:30)">
          Tap <b>Attendance</b> → &quot;Mark All Present&quot; → change anyone who is absent or late → <b>Save</b>.
          Hours and overtime are worked out for you from check-in and check-out times.
        </Step>
        <Step n={3} title="Log the watering">
          After each valve is watered, tap <b>Log Watering</b> on the Daily Routines page.
          Choose the valve, the minutes, and roughly how many litres. Ten seconds per valve.
        </Step>
        <Step n={4} title="Do your tasks — red ones first">
          Tap <b>Daily Tasks</b>. Anything marked <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 mx-1">Priority</Badge>
          comes first — usually a disease treatment. Open the task, press <b>Start</b>, and when
          finished press <b>Complete</b> (add a photo if it asks for one).
        </Step>
        <Step n={5} title="See a sick plant? Report it immediately">
          Tap <b>Disease Management</b> → <b>Report Manually</b> (or <b>AI Detect</b> to check a photo).
          Pick the bed, how bad it looks, add a photo. The manager is alerted at once.
          When the manager sends back instructions, a red Priority task appears in your list —
          do each step of the treatment, tick the steps off, then confirm.
        </Step>
        <Step n={6} title="Harvest ripe beds">
          Tap <b>Harvest Log</b> → choose the bed, the kilograms, the picker and the grade → Save.
          If it&apos;s going to be packed, follow the &quot;create packaging batch&quot; prompt — it fills
          most numbers in for you.
        </Step>
        <Step n={7} title="Used something from the store?">
          Fertilizer, chemicals, boxes — anything taken out must be recorded:
          <b> Input Store</b> → <b>Stock Out</b> → item and amount. This is how the farm knows
          when to buy more.
        </Step>
        <Step n={8} title="Sold to a customer?">
          Tap <b>Customer Orders</b> → <b>New Order</b>. Enter the customer, kilograms and price —
          the total and payment status are calculated for you. Use &quot;Mark paid in full&quot; when
          they pay everything.
        </Step>
        <Step n={9} title="Evening — close the day">
          <span className="inline-flex items-center gap-1"><Sunset className="size-3.5 text-orange-400" /> Before leaving:</span> enter
          check-out times in <b>Attendance</b> and Save again (this records overtime), then write
          a short report of the day in the <b>Day Log</b> — what was done, any problems.
        </Step>
      </Card>

      {/* ── Manager day ── */}
      {isManager && (
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" /> The Manager&apos;s Routine
          </h2>
          <p className="text-xs text-muted-foreground mb-5">Daily, weekly and monthly.</p>

          <Step n={1} title="Every morning — Dashboard + Day Log">
            The <b>Dashboard</b> shows the whole farm at a glance: today&apos;s harvest, sick beds,
            who is on site, and weather-driven disease risk. Then open <b>Daily Routines</b> and
            post the day&apos;s instructions in the <b>Day Log</b> — every supervisor sees them.
          </Step>
          <Step n={2} title="When a disease is reported">
            Open <b>Disease Management</b> → the report is in the red &quot;needs recommendation&quot; group.
            Press <b>Write Recommendation</b>, describe the treatment, and send. The system
            automatically creates a Priority task for the right supervisor, due today.
            When they confirm treatment, you verify and press <b>Resolve</b> — the bed turns
            green again on the map.
          </Step>
          <Step n={3} title="Every week — the Weekly Report">
            <b>Daily Routines → Weekly Report</b> shows money in, money out, the balance, every
            store movement, and each worker&apos;s overtime. At the bottom, the <b>compliance grid</b>:
            a red ✗ means a supervisor recorded nothing that day. Click the ✗ to approve the day
            if there was a good reason (sick, sent to town) — otherwise it won&apos;t be paid.
          </Step>
          <Step n={4} title="Every month — Payroll in four clicks">
            <b>Payroll</b> → <b>Start month</b> → <b>Auto-calculate from Attendance</b> → review
            the numbers → <b>Process All</b>. Days, hours and overtime come straight from the
            attendance records. Export CSV if you need it on paper.
          </Step>
          <Step n={5} title="Check money any time">
            <b>Customer Orders → Revenue &amp; P&amp;L</b> for this month&apos;s profit;
            <b> Expenses</b> for spending; <b>Analytics</b> for season totals.
          </Step>
          <Step n={6} title="Change farm rules in Settings">
            <b>Settings</b> holds the daily wage, the workday hours, the overtime rate, the daily
            harvest target and Telegram alerts. Change a number there and the whole system uses
            it — payroll, targets, everything.
          </Step>
        </Card>
      )}

      {/* ── Notifications ── */}
      <Card className="p-5">
        <h2 className="font-bold text-base mb-2 flex items-center gap-2"><Bell className="size-4 text-primary" /> The bell and Telegram</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <b>bell</b> (top right) shows what needs <i>your</i> attention — tasks assigned to you,
          instructions, approvals. Check it whenever you open the app. Urgent things (disease
          instructions, critical low stock, priority tasks) also arrive on <b>Telegram</b>, so you
          hear about them even away from the computer.
        </p>
      </Card>

      {/* ── Page reference ── */}
      <Card className="p-6">
        <h2 className="font-bold text-base mb-4">What each page is for</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            { icon: ClipboardCheck, name: "Daily Routines", what: "Your daily checklist + the Day Log (messages between manager and supervisors)" },
            { icon: CalendarCheck, name: "Attendance", what: "Who came to work, check-in/out, overtime" },
            { icon: Bug, name: "Disease Management", what: "Report sick plants, treatments, track until cured" },
            { icon: Wheat, name: "Harvest Log", what: "Record every picking — bed, kg, grade" },
            { icon: Droplets, name: "Nutrient Feeding", what: "Fertilizer applications per valve" },
            { icon: Warehouse, name: "Input Store", what: "Fertilizer/chemical/box inventory — record everything in and out" },
            { icon: ShoppingCart, name: "Customer Orders", what: "Record sales and deliveries to customers" },
            { icon: DollarSign, name: "Payroll (manager)", what: "Monthly wages, calculated from attendance" },
            { icon: MessageSquare, name: "Day Log", what: "Daily instructions (manager) and reports (supervisors)" },
            { icon: Bot, name: "AI Alerts & Assistant", what: "Ask questions about the farm in plain words; smart warnings" },
          ].map(({ icon: Icon, name, what }) => (
            <div key={name} className="flex items-start gap-2 py-1.5 border-b border-border/50">
              <Icon className="size-4 text-primary shrink-0 mt-0.5" />
              <div><span className="font-semibold">{name}</span> <span className="text-muted-foreground">— {what}</span></div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── FAQ-ish ── */}
      <Card className="p-6">
        <h2 className="font-bold text-base mb-4">Quick answers</h2>
        <div className="space-y-3 text-sm">
          {[
            ["I made a mistake in attendance.", "Open Attendance the same day, correct it, and press Save again — it overwrites."],
            ["What is the difference between a Task and a Follow-up?", "A task is work to do (“spray bed A-06”). A follow-up is a reminder to check the work was done (“confirm A-06 was sprayed”)."],
            ["Why is my day marked with a red ✗?", "Nothing was recorded that day. Ask the manager to approve it if you were working but couldn't record (the manager clicks the ✗)."],
            ["The stock number is wrong after counting.", "Input Store → record an Adjustment: + to increase, − to decrease to the counted amount."],
            ["A customer paid the rest of their money.", "Customer Orders → pencil icon on the order → “Mark paid in full” → Save."],
            ["I forgot my password.", "Ask the manager — passwords are managed by the farm."],
          ].map(([q, a]) => (
            <div key={q} className="flex gap-2">
              <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
              <div><span className="font-semibold">{q}</span> <span className="text-muted-foreground">{a}</span></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
