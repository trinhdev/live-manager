
export type Role = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF' | 'OPERATIONS';

export type Rank = 'S' | 'A' | 'B' | 'C';

export type Platform = 'tiktok' | 'shopee';

export interface Brand {
  id: string;       // slug dùng trong URL: 'gimmetee'
  name: string;     // Tên hiển thị: 'Gimmetee'
  logoUrl?: string;
  color?: string;   // Hex color cho brand accent
  active?: boolean;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  brandId?: string;            // null / undefined cho SUPER_ADMIN
  platforms?: Platform[];      // ['tiktok'], ['shopee'], ['tiktok','shopee']
  rank?: Rank;
  password: string;
  avatar?: string;
  revenue?: number;
  zaloPhone?: string;
  isAvailabilitySubmitted?: boolean;
  hourlyRate?: number;         // VNĐ/giờ, dùng để tính lương
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  platform: Platform;
}

export interface Availability {
  userId: string;
  dayIndex: number;
  shiftId: string;
  weekId: string;
  brandId?: string;
  platform: Platform;
}

export interface StreamerAssignment {
  userId: string;
  timeLabel?: string;     // Kẹp ca: "19h - 21h" (ghi đè giờ ca)
  overtimeMinutes?: number; // Thêm giờ: số phút live thêm sau ca
}

export interface ScheduleItem {
  id: string;
  dayIndex: number;
  shiftId: string;
  weekId: string;
  brandId?: string;
  platform: Platform;
  streamerAssignments: StreamerAssignment[];
  opsUserId: string | null;
  note?: string;
  isFinalized?: boolean;
  lateStartMinutes?: number;  // Số phút lên trễ so với giờ ca gốc
  lateReason?: string;        // Lý do lên trễ (tùy chọn)
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type RequestType = 'LEAVE' | 'SWAP';

export interface ShiftRequest {
  id: string;
  userId: string;
  userName: string;
  type: RequestType;
  dayIndex: number;
  shiftId: string;
  weekId: string;
  brandId?: string;
  platform: Platform;
  reason: string;
  proposedTime?: string;
  targetUserId?: string;
  targetUserName?: string;
  status: RequestStatus;
  createdAt: number;
}

export type ViewMode = 'DASHBOARD' | 'MY_AVAILABILITY' | 'STAFF_MANAGEMENT' | 'SETTINGS' | 'REQUESTS' | 'REPORTS' | 'TIMEKEEPING' | 'MY_SALARY';

export type NotificationType = 'ANNOUNCEMENT' | 'REMINDER' | 'REQUEST_NEW' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED' | 'AVAILABILITY_REGISTERED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  platform?: Platform;
  brandId?: string;             // brand scope — null = global (super admin)
  targetUserIds?: string[];   // null = all, array = specific users
  createdBy?: string;
  createdAt: number;
  readBy?: string[];          // user IDs who have read this
}
export interface TimekeepingRecord {
  id?: string;
  userId: string;
  brandId?: string;
  month: number;         // 1-12
  year: number;
  bonusAmount: number;   // Tiền hỗ trợ (VNĐ)
  note?: string;
}
