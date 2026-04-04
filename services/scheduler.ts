
import { User, Availability, Shift, ScheduleItem, Rank } from '../types';
import { DAYS_OF_WEEK } from '../constants';

const RANK_PRIORITY: Record<Rank, number> = {
  'S': 4,
  'A': 3,
  'B': 2,
  'C': 1
};

export const autoGenerateSchedule = (
  users: User[],
  shifts: Shift[],
  availabilities: Availability[],
  existingSchedule: ScheduleItem[],
  currentWeekId: string
): ScheduleItem[] => {
  
  // Filter data for current week only
  const weekAvailabilities = availabilities.filter(a => a.weekId === currentWeekId);
  const weekSchedule = existingSchedule.filter(s => s.weekId === currentWeekId);
  
  // Start with existing schedule for this week to preserve manual edits if needed, 
  // or empty array if we want a fresh start. Here we do fresh start + keep manual logic outside.
  // For simplicity in this demo, we generate a fresh list to be merged in App.tsx
  const newSchedule: ScheduleItem[] = [];

  for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
    for (const shift of shifts) {
      // Skip if slot already filled in existing schedule (optional logic, but let's overwrite for "Auto")
      
      // 1. Find who is available for this slot (Streamers only)
      const availableStreamers = users.filter(user => 
        user.role === 'STAFF' &&
        weekAvailabilities.some(a => a.userId === user.id && a.dayIndex === dayIndex && a.shiftId === shift.id)
      );

      // 2. Sort candidates by Rank (Revenue)
      availableStreamers.sort((a, b) => {
        // Fallback for missing rank
        const rankA = a.rank || 'C';
        const rankB = b.rank || 'C';
        const rankDiff = RANK_PRIORITY[rankB] - RANK_PRIORITY[rankA];
        if (rankDiff !== 0) return rankDiff;
        return (b.revenue || 0) - (a.revenue || 0);
      });

      // 3. Assign the top candidate
      if (availableStreamers.length > 0) {
        // Check burnout: max 2 shifts per day in the NEW schedule
        const topCandidate = availableStreamers.find(u => {
            const shiftsToday = newSchedule.filter(s => s.dayIndex === dayIndex && s.streamerAssignments.some(sa => sa.userId === u.id)).length;
            return shiftsToday < 2; 
        });

        if (topCandidate) {
            newSchedule.push({
              id: `${currentWeekId}-${dayIndex}-${shift.id}-${Date.now()}`,
              dayIndex,
              shiftId: shift.id,
              weekId: currentWeekId,
              streamerAssignments: [{ userId: topCandidate.id }],
              opsUserId: null, 
              note: 'Tự động xếp'
            });
        }
      }
    }
  }

  return newSchedule;
};
