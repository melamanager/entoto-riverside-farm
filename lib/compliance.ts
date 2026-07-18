import { prisma } from "@/lib/prisma";

// Business rule: a supervisor must record their daily routines (take attendance,
// log watering, or post in the Day Log). A day with none of these does NOT count
// as a worked day unless a manager acknowledges it.

export type ComplianceRow = {
  date: string;
  supervisorId: string;
  name: string;
  avatar: string;
  attendance: boolean;
  watering: boolean;
  dayLog: boolean;
  recorded: boolean;
  acknowledged: boolean;
  ackByName: string | null;
  ackNote: string | null;
};

export async function complianceForRange(from: string, to: string): Promise<ComplianceRow[]> {
  const [supervisors, att, irr, notes, acks] = await Promise.all([
    prisma.farmer.findMany({ where: { role: "supervisor" }, select: { id: true, name: true, avatar: true } }),
    prisma.attendanceRecord.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, recordedBy: true } }),
    prisma.irrigationLog.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, recordedBy: true } }),
    prisma.dailyNote.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, authorId: true } }),
    prisma.routineAck.findMany({
      where: { date: { gte: from, lte: to } },
      include: { acker: { select: { name: true } } },
    }),
  ]);

  const attSet = new Set(att.map((a) => `${a.recordedBy}|${a.date}`));
  const irrSet = new Set(irr.map((a) => `${a.recordedBy}|${a.date}`));
  const noteSet = new Set(notes.map((a) => `${a.authorId}|${a.date}`));
  const ackMap = new Map(acks.map((a) => [`${a.supervisorId}|${a.date}`, a]));

  const days: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    days.push(d.toISOString().split("T")[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const rows: ComplianceRow[] = [];
  for (const s of supervisors) {
    for (const date of days) {
      const key = `${s.id}|${date}`;
      const attendance = attSet.has(key);
      const watering = irrSet.has(key);
      const dayLog = noteSet.has(key);
      const ack = ackMap.get(key);
      rows.push({
        date,
        supervisorId: s.id,
        name: s.name,
        avatar: s.avatar,
        attendance,
        watering,
        dayLog,
        recorded: attendance || watering || dayLog,
        acknowledged: !!ack,
        ackByName: ack?.acker.name ?? null,
        ackNote: ack?.note ?? null,
      });
    }
  }
  return rows;
}

// key helper for fast lookup: counted work-days for supervisors
export function countedDaySet(rows: ComplianceRow[]): Set<string> {
  return new Set(rows.filter((r) => r.recorded || r.acknowledged).map((r) => `${r.supervisorId}|${r.date}`));
}
