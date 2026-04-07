import { Shift, User, ScheduleItem, Platform } from './types';

export const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

// ── Platform Configuration ──────────────────────────────────
export const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; bgLight: string; borderColor: string }> = {
  tiktok: {
    label: 'TikTok',
    color: '#000000',
    bgLight: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  shopee: {
    label: 'Shopee',
    color: '#EE4D2D',
    bgLight: '#FFF5F2',
    borderColor: '#FECACA',
  },
};

// ── TikTok SVG Logo ─────────────────────────────────────────
export const TIKTOK_LOGO_SVG = `<svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M34.1 0h-8.6v32.7c0 3.8-3 6.9-6.8 6.9s-6.8-3.1-6.8-6.9c0-3.8 3-6.9 6.8-6.9.7 0 1.4.1 2.1.3v-8.8c-.7-.1-1.4-.1-2.1-.1C10.3 17.2 3.4 24.1 3.4 32.7S10.3 48.1 18.7 48c8.4 0 15.3-6.8 15.3-15.3V15.9c3.3 2.4 7.3 3.8 11.6 3.8v-8.6c-6.4-.1-11.5-5.2-11.5-11.1z" fill="currentColor"/></svg>`;

// ── Shopee SVG Logo ─────────────────────────────────────────
export const SHOPEE_LOGO_SVG = `<svg viewBox="0 0 50 50" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M25 2c-3.9 0-7.2 3-7.5 6.8L10.8 8C8.6 8 6.8 9.7 6.5 11.9L3.1 42.1C2.9 44.6 4.8 46.8 7.3 47h35.4c2.5-.2 4.4-2.4 4.2-4.9L43.5 11.9c-.3-2.2-2.1-3.9-4.3-3.9l-6.7.8C32.2 5 28.9 2 25 2zm0 4c1.9 0 3.5 1.4 3.7 3.2L21.3 9.2C21.5 7.4 23.1 6 25 6zm-3 14c0 1.7 1.3 3 3 3s3-1.3 3-3h4c0 3.9-3.1 7-7 7s-7-3.1-7-7h4z" fill="currentColor"/></svg>`;

export const INITIAL_SHIFTS: Shift[] = [
  { id: 'morning', name: 'Ca Sáng', startTime: '08:00', endTime: '12:00', color: 'bg-orange-100 text-orange-800 border-orange-200', platform: 'tiktok' },
  { id: 'afternoon', name: 'Ca Chiều', startTime: '13:00', endTime: '17:00', color: 'bg-blue-100 text-blue-800 border-blue-200', platform: 'tiktok' },
  { id: 'evening', name: 'Ca Tối (Prime)', startTime: '19:00', endTime: '23:00', color: 'bg-purple-100 text-purple-800 border-purple-200', platform: 'tiktok' },
  { id: 'late', name: 'Ca Đêm', startTime: '23:30', endTime: '02:00', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', platform: 'tiktok' },
];

export const INITIAL_USERS: User[] = [
  { id: 'admin', name: 'Quản Lý Chính', role: 'MANAGER', rank: 'S', password: 'admin', avatar: 'https://picsum.photos/id/1/200/200', revenue: 0, platforms: ['tiktok', 'shopee'] },
  { id: 'u1', name: 'Hương Live', role: 'STAFF', rank: 'S', password: '123', avatar: 'https://picsum.photos/id/64/200/200', revenue: 150000000, platforms: ['tiktok'] },
  { id: 'u2', name: 'Tuấn Host', role: 'STAFF', rank: 'A', password: '123', avatar: 'https://picsum.photos/id/91/200/200', revenue: 90000000, platforms: ['tiktok', 'shopee'] },
  { id: 'u3', name: 'Lan Talk', role: 'STAFF', rank: 'B', password: '123', avatar: 'https://picsum.photos/id/129/200/200', revenue: 50000000, platforms: ['shopee'] },
  { id: 'u4', name: 'Đạt Game', role: 'STAFF', rank: 'C', password: '123', avatar: 'https://picsum.photos/id/177/200/200', revenue: 20000000, platforms: ['tiktok'] },
  { id: 'u5', name: 'Vy Life', role: 'STAFF', rank: 'A', password: '123', avatar: 'https://picsum.photos/id/203/200/200', revenue: 85000000, platforms: ['tiktok', 'shopee'] },
  // Operations Staff
  { id: 'ops1', name: 'Kỹ Thuật Hùng', role: 'OPERATIONS', password: '123', avatar: 'https://picsum.photos/id/300/200/200', platforms: ['tiktok', 'shopee'] },
  { id: 'ops2', name: 'Trợ Lý Mai', role: 'OPERATIONS', password: '123', avatar: 'https://picsum.photos/id/301/200/200', platforms: ['tiktok'] },
];

export const generateInitialSchedule = (): ScheduleItem[] => {
  return [];
};