
import { User, Availability, Shift, ScheduleItem, Rank, Platform } from '../types';
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
  currentWeekId: string,
  platform: Platform = 'tiktok'
): ScheduleItem[] => {
  
  // Filter data for current week and platform only
  const weekAvailabilities = availabilities.filter(a => a.weekId === currentWeekId && a.platform === platform);
  const weekSchedule = existingSchedule.filter(s => s.weekId === currentWeekId && s.platform === platform);
  
  // Filter shifts for this platform
  const platformShifts = shifts.filter(s => s.platform === platform);
  
  // Filter users who work on this platform
  const platformUsers = users.filter(u => u.platforms?.includes(platform));
  
  const newSchedule: ScheduleItem[] = [];

  for (let dayIndex = 0; dayIndex < DAYS_OF_WEEK.length; dayIndex++) {
    for (const shift of platformShifts) {
      // 1. Find who is available for this slot (Streamers only)
      const availableStreamers = platformUsers.filter(user => 
        user.role === 'STAFF' &&
        weekAvailabilities.some(a => a.userId === user.id && a.dayIndex === dayIndex && a.shiftId === shift.id)
      );

      // 2. Sort candidates by Rank (Revenue)
      availableStreamers.sort((a, b) => {
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
              id: `${currentWeekId}-${platform}-${dayIndex}-${shift.id}-${Date.now()}`,
              dayIndex,
              shiftId: shift.id,
              weekId: currentWeekId,
              platform,
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
