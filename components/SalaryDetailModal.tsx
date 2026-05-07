import React from 'react';
import { X, Clock, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { User, ScheduleItem, Shift } from '../types';
import { DAYS_OF_WEEK } from '../constants';

interface SalaryDetailModalProps {
  user: User;
  schedule: ScheduleItem[]; // all schedule items (across all weeks in current month)
  shifts: Shift[];
  weekDates: Date[][]; // array of weekDates per week
  onClose: () => void;
  monthLabel: string; // e.g. "Tháng 5/2026"
}

const parseTimeToHours = (t: string): number => {
  if (!t) return 0;
  const clean = t.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2})(?:[:h](\d{1,2}))?/);
  if (match) {
    const h = parseInt(match[1]);
    const m = match[2] ? parseInt(match[2]) : 0;
    return h + m / 60;
  }
  return 0;
};

const calcShiftHours = (shift: Shift, sa: { timeLabel?: string; overtimeMinutes?: number }): number => {
  let base = 0;
  if (sa.timeLabel) {
    // Kẹp ca: dùng timeLabel thay thế giờ ca
    const parts = sa.timeLabel.split(/\s*-\s*/);
    if (parts.length === 2) {
      const start = parseTimeToHours(parts[0]);
      const end = parseTimeToHours(parts[1]);
      if (start > 0 && end > 0) {
        base = end - start;
        if (base < 0) base += 24;
      }
    }
  } else {
    // Dùng giờ ca gốc
    const start = parseTimeToHours(shift.startTime);
    const end = parseTimeToHours(shift.endTime);
    if (start > 0 && end > 0) {
      base = end - start;
      if (base < 0) base += 24;
    }
    if (base === 0) base = 4; // fallback
  }
  // Cộng thêm giờ
  const overtime = (sa.overtimeMinutes || 0) / 60;
  return base + overtime;
};

export function SalaryDetailModal({ user, schedule, shifts, weekDates, onClose, monthLabel }: SalaryDetailModalProps) {
  const hourlyRate = user.hourlyRate || 0;

  // Build list of all shifts this user was in, with dates
  const rows: {
    date: Date | null;
    dayLabel: string;
    shift: Shift;
    timeDisplay: string;
    overtimeMinutes: number;
    hours: number;
    salary: number;
    weekLabel: string;
  }[] = [];

  schedule.forEach(item => {
    const sa = item.streamerAssignments.find(a => a.userId === user.id);
    const isOps = item.opsUserId === user.id;
    if (!sa && !isOps) return;

    const shift = shifts.find(s => s.id === item.shiftId);
    if (!shift) return;

    // Find actual date from weekDates
    let date: Date | null = null;
    let weekLabel = '';
    weekDates.forEach((wd, wi) => {
      if (wd[item.dayIndex]) {
        // Match by weekId prefix
        const wdYear = wd[0]?.getFullYear();
        const wdMonth = wd[0]?.getMonth();
        const itemWeekNum = parseInt(item.weekId?.split('-W')[1] || '0');
        if (itemWeekNum === wi + 1 || wd[item.dayIndex]) {
          // use this week's date for this dayIndex
          date = wd[item.dayIndex];
          weekLabel = `Tuần ${wi + 1}`;
        }
      }
    });

    const saData = sa || { userId: user.id };
    const hours = isOps
      ? (() => {
          const s = parseTimeToHours(shift.startTime);
          const e = parseTimeToHours(shift.endTime);
          let d = e - s;
          if (d < 0) d += 24;
          return d || 4;
        })()
      : calcShiftHours(shift, saData as any);

    const overtimeMinutes = (saData as any).overtimeMinutes || 0;
    const salary = hours * hourlyRate;

    let timeDisplay = `${shift.startTime}–${shift.endTime}`;
    if ((saData as any).timeLabel) timeDisplay = (saData as any).timeLabel;
    if (overtimeMinutes > 0) timeDisplay += ` +${overtimeMinutes}ph`;
    if (isOps) timeDisplay += ' (KT)';

    rows.push({
      date,
      dayLabel: DAYS_OF_WEEK[item.dayIndex] || '',
      shift,
      timeDisplay,
      overtimeMinutes,
      hours,
      salary,
      weekLabel,
    });
  });

  // Sort by date
  rows.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalSalary = rows.reduce((s, r) => s + r.salary, 0);
  const totalOvertime = rows.reduce((s, r) => s + r.overtimeMinutes, 0);

  const fmt = (n: number) => n.toLocaleString('vi-VN');
  const fmtH = (h: number) => h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: '#fff', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F0F0F0' }}>
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" style={{ border: '2px solid #E5E5E5' }} alt="" />
            <div>
              <p className="text-[15px] font-semibold tracking-tight" style={{ color: '#171717' }}>{user.name}</p>
              <p className="text-[12px]" style={{ color: '#A3A3A3' }}>
                {monthLabel} · {hourlyRate > 0 ? `${fmt(hourlyRate)}đ/giờ` : 'Chưa thiết lập lương'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={16} style={{ color: '#737373' }} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4" style={{ borderBottom: '1px solid #F5F5F5' }}>
          {[
            { label: 'Tổng ca', value: `${rows.length} ca`, icon: <Calendar size={14} />, color: '#4F46E5' },
            { label: 'Tổng giờ', value: fmtH(totalHours), icon: <Clock size={14} />, color: '#0891B2', sub: totalOvertime > 0 ? `+${totalOvertime}ph OT` : undefined },
            { label: 'Thành tiền', value: hourlyRate > 0 ? `${fmt(Math.round(totalSalary))}đ` : '—', icon: <DollarSign size={14} />, color: '#059669' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col gap-1 p-3 rounded-2xl" style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
              <div className="flex items-center gap-1.5" style={{ color: s.color }}>
                {s.icon}
                <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
              </div>
              <p className="text-[16px] font-bold tabular-nums tracking-tight" style={{ color: '#171717' }}>{s.value}</p>
              {s.sub && <p className="text-[10px]" style={{ color: s.color }}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Shift rows */}
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center py-16" style={{ color: '#D4D4D4' }}>
              <TrendingUp size={28} />
              <p className="text-[13px] mt-3" style={{ color: '#A3A3A3' }}>Chưa có ca nào trong tháng này</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
                  {['Ngày', 'Ca', 'Giờ live', 'Số giờ', 'Thành tiền'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#A3A3A3' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="transition-colors hover:bg-slate-50" style={{ borderTop: i > 0 ? '1px solid #F5F5F5' : 'none' }}>
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-medium" style={{ color: '#171717' }}>
                        {r.date ? `${r.date.getDate()}/${r.date.getMonth() + 1}` : '—'}
                      </p>
                      <p className="text-[10px]" style={{ color: '#A3A3A3' }}>{r.dayLabel.replace('Thứ ', 'T')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-semibold" style={{ color: '#171717' }}>{r.shift.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-mono" style={{ color: '#737373' }}>{r.timeDisplay}</span>
                        {r.overtimeMinutes > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>
                            +{r.overtimeMinutes}ph
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: '#171717' }}>{fmtH(r.hours)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {hourlyRate > 0 ? (
                        <span className="text-[13px] font-semibold tabular-nums" style={{ color: '#059669' }}>
                          {fmt(Math.round(r.salary))}đ
                        </span>
                      ) : (
                        <span style={{ color: '#D4D4D4' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer total */}
              <tfoot>
                <tr style={{ borderTop: '2px solid #E5E5E5', background: '#FAFAFA' }}>
                  <td colSpan={3} className="px-4 py-3">
                    <span className="text-[12px] font-semibold" style={{ color: '#737373' }}>Tổng cộng</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: '#171717' }}>{fmtH(totalHours)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {hourlyRate > 0 && (
                      <span className="text-[14px] font-bold tabular-nums" style={{ color: '#059669' }}>
                        {fmt(Math.round(totalSalary))}đ
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Close footer */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid #F0F0F0' }}>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-gray-100"
            style={{ border: '1px solid #E5E5E5', color: '#737373' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
