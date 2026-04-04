import { Shift, User, ScheduleItem } from './types';

export const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export const INITIAL_SHIFTS: Shift[] = [
  { id: 'morning', name: 'Ca Sáng', startTime: '08:00', endTime: '12:00', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'afternoon', name: 'Ca Chiều', startTime: '13:00', endTime: '17:00', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'evening', name: 'Ca Tối (Prime)', startTime: '19:00', endTime: '23:00', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'late', name: 'Ca Đêm', startTime: '23:30', endTime: '02:00', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
];

export const INITIAL_USERS: User[] = [
  { id: 'admin', name: 'Quản Lý Chính', role: 'MANAGER', rank: 'S', password: 'admin', avatar: 'https://picsum.photos/id/1/200/200', revenue: 0 },
  { id: 'u1', name: 'Hương Live', role: 'STAFF', rank: 'S', password: '123', avatar: 'https://picsum.photos/id/64/200/200', revenue: 150000000 },
  { id: 'u2', name: 'Tuấn Host', role: 'STAFF', rank: 'A', password: '123', avatar: 'https://picsum.photos/id/91/200/200', revenue: 90000000 },
  { id: 'u3', name: 'Lan Talk', role: 'STAFF', rank: 'B', password: '123', avatar: 'https://picsum.photos/id/129/200/200', revenue: 50000000 },
  { id: 'u4', name: 'Đạt Game', role: 'STAFF', rank: 'C', password: '123', avatar: 'https://picsum.photos/id/177/200/200', revenue: 20000000 },
  { id: 'u5', name: 'Vy Life', role: 'STAFF', rank: 'A', password: '123', avatar: 'https://picsum.photos/id/203/200/200', revenue: 85000000 },
  // Operations Staff
  { id: 'ops1', name: 'Kỹ Thuật Hùng', role: 'OPERATIONS', password: '123', avatar: 'https://picsum.photos/id/300/200/200' },
  { id: 'ops2', name: 'Trợ Lý Mai', role: 'OPERATIONS', password: '123', avatar: 'https://picsum.photos/id/301/200/200' },
];

export const generateInitialSchedule = (): ScheduleItem[] => {
  return [];
};