
import { supabase } from './supabase';
import { User, Brand, Shift, Availability, ScheduleItem, ShiftRequest, Platform, AppNotification } from '../types';
import { INITIAL_USERS, INITIAL_SHIFTS } from '../constants';

export const sendOneSignalPush = async (title: string, message: string, targetUserIds?: string[] | null) => {
  const APP_ID = (import.meta as any).env.VITE_ONESIGNAL_APP_ID;
  const REST_API_KEY = (import.meta as any).env.VITE_ONESIGNAL_REST_API_KEY;

  if (!APP_ID || APP_ID === 'CHANGEME_APP_ID' || !REST_API_KEY || REST_API_KEY === 'CHANGEME_REST_API_KEY') {
    return;
  }

  const payload: any = {
    app_id: APP_ID,
    headings: { en: title, vi: title },
    contents: { en: message, vi: message },
    target_channel: "push"
  };

  if (targetUserIds && targetUserIds.length > 0) {
    payload.include_aliases = { external_id: targetUserIds };
  } else {
    payload.included_segments = ["All"];
  }

  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("Lỗi gửi OneSignal Push:", error);
  }
};

// Helper: map User from DB (snake_case) to App (camelCase)
const mapUser = (u: any): User => ({
  id: u.id,
  name: u.name,
  role: u.role,
  brandId: u.brand_id,
  platforms: u.platforms || ['tiktok'],
  rank: u.rank,
  password: u.password,
  avatar: u.avatar,
  revenue: u.revenue,
  zaloPhone: u.zalo_phone || u.zaloPhone,
  isAvailabilitySubmitted: u.is_availability_submitted || u.isAvailabilitySubmitted,
});

// Helper: map Shift
const mapShift = (s: any): Shift => ({
  id: s.id,
  name: s.name,
  startTime: s.start_time || s.startTime,
  endTime: s.end_time || s.endTime,
  color: s.color,
  platform: s.platform || 'tiktok',
});

// Helper: map Brand
const mapBrand = (b: any): Brand => ({
  id: b.id,
  name: b.name,
  logoUrl: b.logo_url,
  color: b.color,
  active: b.active,
});

export const api = {
  // ─── BRANDS ────────────────────────────────────────────────

  async getBrands(): Promise<Brand[]> {
    const { data, error } = await supabase.from('brands').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapBrand);
  },

  async getBrand(brandId: string): Promise<Brand> {
    const { data, error } = await supabase.from('brands').select('*').eq('id', brandId).single();
    if (error) throw error;
    return mapBrand(data);
  },

  async saveBrand(brand: Brand): Promise<Brand> {
    const payload = {
      id: brand.id,
      name: brand.name,
      logo_url: brand.logoUrl || null,
      color: brand.color || '#2563EB',
      active: brand.active ?? true,
    };
    const { data, error } = await supabase.from('brands').upsert(payload).select().single();
    if (error) throw error;
    return mapBrand(data);
  },

  async deleteBrand(brandId: string): Promise<void> {
    const { error } = await supabase.from('brands').delete().eq('id', brandId);
    if (error) throw error;
  },

  // ─── USERS ─────────────────────────────────────────────────

  async getUsers(brandId?: string): Promise<User[]> {
    try {
      let query = supabase.from('users').select('*');
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase getUsers error:', error.message);
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }
      return data.map(mapUser);
    } catch (e) {
      console.warn('API Exception (users)');
      return [];
    }
  },

  async updateUser(user: Partial<User>, oldId?: string): Promise<User> {
    const dbUser: any = {
      ...user,
      brand_id: user.brandId,
      platforms: user.platforms || ['tiktok'],
      zalo_phone: user.zaloPhone,
      is_availability_submitted: user.isAvailabilitySubmitted,
    };
    delete dbUser.brandId;
    delete dbUser.zaloPhone;
    delete dbUser.isAvailabilitySubmitted;

    if (oldId && oldId !== user.id) {
      const { error } = await supabase.from('users').update(dbUser).eq('id', oldId);
      if (error) throw error;
      const { data, error: err2 } = await supabase.from('users').select().eq('id', user.id).single();
      if (err2) throw err2;
      return mapUser(data);
    } else {
      const { data, error } = await supabase.from('users').upsert(dbUser).select().single();
      if (error) throw error;
      return mapUser(data);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
  },

  // ─── SHIFTS ────────────────────────────────────────────────

  async getShifts(brandId?: string, platform?: Platform): Promise<Shift[]> {
    try {
      let query = supabase.from('shifts').select('*').order('start_time', { ascending: true });
      if (brandId) query = query.eq('brand_id', brandId);
      if (platform) query = query.eq('platform', platform);
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase getShifts error:', error.message);
        return [];
      }
      if (!data || data.length === 0) return [];
      return data.map(mapShift).sort((a: Shift, b: Shift) => a.startTime.localeCompare(b.startTime));
    } catch (e) {
      console.warn('API Exception (shifts)');
      return [];
    }
  },

  async updateShift(shift: Shift, brandId?: string): Promise<Shift> {
    const dbShift: any = {
      id: shift.id,
      name: shift.name,
      start_time: shift.startTime,
      end_time: shift.endTime,
      color: shift.color,
      platform: shift.platform || 'tiktok',
    };
    if (brandId) dbShift.brand_id = brandId;
    const { data, error } = await supabase.from('shifts').upsert(dbShift).select().single();
    if (error) throw error;
    return mapShift(data);
  },

  async deleteShift(shiftId: string): Promise<void> {
    const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
    if (error) throw error;
  },

  // ─── SCHEDULE ──────────────────────────────────────────────

  async getSchedule(weekId: string, brandId?: string, platform?: Platform): Promise<ScheduleItem[]> {
    try {
      let query = supabase.from('schedule').select('*').eq('week_id', weekId);
      if (brandId) query = query.eq('brand_id', brandId);
      if (platform) query = query.eq('platform', platform);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        weekId: item.week_id,
        dayIndex: item.day_index,
        shiftId: item.shift_id,
        brandId: item.brand_id,
        platform: item.platform || 'tiktok',
        opsUserId: item.ops_user_id,
        note: item.note,
        isFinalized: item.is_finalized,
        streamerAssignments: item.streamer_assignments || [],
      })) as ScheduleItem[];
    } catch (e) {
      console.log('Using empty schedule (Offline/Error)');
      return [];
    }
  },

  async saveScheduleItem(item: ScheduleItem): Promise<any> {
    const payload: any = {
      id: item.id,
      week_id: item.weekId,
      day_index: item.dayIndex,
      shift_id: item.shiftId,
      ops_user_id: item.opsUserId,
      platform: item.platform || 'tiktok',
      note: item.note,
      is_finalized: item.isFinalized,
      streamer_assignments: item.streamerAssignments,
    };
    if (item.brandId) payload.brand_id = item.brandId;
    const { data, error } = await supabase.from('schedule').upsert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async deleteScheduleItem(id: string): Promise<void> {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) throw error;
  },

  async clearSchedule(weekId: string, brandId?: string, platform?: Platform): Promise<void> {
    let query = supabase.from('schedule').delete().eq('week_id', weekId);
    if (brandId) query = (query as any).eq('brand_id', brandId);
    if (platform) query = (query as any).eq('platform', platform);
    const { error } = await query;
    if (error) throw error;
  },

  // ─── AVAILABILITY ──────────────────────────────────────────

  async getAvailabilities(weekId: string, brandId?: string, platform?: Platform): Promise<Availability[]> {
    try {
      let query = supabase.from('availabilities').select('*').eq('week_id', weekId);
      if (brandId) query = query.eq('brand_id', brandId);
      if (platform) query = query.eq('platform', platform);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        userId: item.user_id,
        weekId: item.week_id,
        dayIndex: item.day_index,
        shiftId: item.shift_id,
        brandId: item.brand_id,
        platform: item.platform || 'tiktok',
      })) as Availability[];
    } catch (e) {
      return [];
    }
  },

  async toggleAvailability(av: Availability): Promise<'added' | 'removed'> {
    const matchObj: any = {
      user_id: av.userId,
      week_id: av.weekId,
      day_index: av.dayIndex,
      shift_id: av.shiftId,
      platform: av.platform || 'tiktok',
    };
    if (av.brandId) matchObj.brand_id = av.brandId;

    const { data: existing } = await supabase
      .from('availabilities')
      .select('id')
      .match(matchObj)
      .maybeSingle();

    if (existing) {
      await supabase.from('availabilities').delete().eq('id', existing.id);
      return 'removed';
    } else {
      const insertObj: any = {
        user_id: av.userId,
        week_id: av.weekId,
        day_index: av.dayIndex,
        shift_id: av.shiftId,
        platform: av.platform || 'tiktok',
      };
      if (av.brandId) insertObj.brand_id = av.brandId;
      await supabase.from('availabilities').insert(insertObj);
      return 'added';
    }
  },

  async clearAvailabilities(weekId: string, brandId?: string): Promise<void> {
    let query = supabase.from('availabilities').delete().eq('week_id', weekId);
    if (brandId) query = (query as any).eq('brand_id', brandId);
    const { error } = await query;
    if (error) throw error;
  },

  // ─── REQUESTS ──────────────────────────────────────────────

  async getRequests(weekId: string, brandId?: string, platform?: Platform): Promise<ShiftRequest[]> {
    try {
      let query = supabase
        .from('requests')
        .select('*')
        .eq('week_id', weekId)
        .order('created_at', { ascending: false });
      if (brandId) query = query.eq('brand_id', brandId);
      if (platform) query = query.eq('platform', platform);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        userName: item.user_name,
        type: item.type,
        weekId: item.week_id,
        dayIndex: item.day_index,
        shiftId: item.shift_id,
        brandId: item.brand_id,
        platform: item.platform || 'tiktok',
        reason: item.reason,
        targetUserId: item.target_user_id,
        targetUserName: item.target_user_name,
        status: item.status,
        createdAt: item.created_at,
      })) as ShiftRequest[];
    } catch (e) {
      return [];
    }
  },

  async createRequest(req: ShiftRequest): Promise<void> {
    const payload: any = {
      id: req.id,
      user_id: req.userId,
      user_name: req.userName,
      type: req.type,
      week_id: req.weekId,
      day_index: req.dayIndex,
      shift_id: req.shiftId,
      platform: req.platform || 'tiktok',
      reason: req.reason,
      target_user_id: req.targetUserId,
      target_user_name: req.targetUserName,
      status: req.status,
      created_at: req.createdAt,
    };
    if (req.brandId) payload.brand_id = req.brandId;
    const { error } = await supabase.from('requests').insert(payload);
    if (error) throw error;
  },

  async updateRequestStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);
    if (error) throw error;
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  
  async getNotifications(): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Lỗi khi fetch notifications', error);
      return [];
    }
    
    return data.map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      platform: n.platform,
      targetUserIds: n.targetUserIds,
      createdBy: n.createdBy,
      createdAt: Number(n.createdAt),
      readBy: n.readBy || []
    }));
  },

  async createNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'readBy'>): Promise<AppNotification> {
    const payload = {
      type: notif.type,
      title: notif.title,
      message: notif.message,
      platform: notif.platform || null,
      targetUserIds: notif.targetUserIds || null,
      createdBy: notif.createdBy || null,
      createdAt: Date.now(),
      readBy: []
    };

    const { data, error } = await supabase.from('notifications').insert(payload).select().single();
    if (error) {
      console.error('Lỗi khi tạo notification', error);
      throw error;
    }
    
    // Gửi Push Notification qua OneSignal ngay lập tức cho các thiết bị đã tắt app
    sendOneSignalPush(notif.title, notif.message, notif.targetUserIds);
    
    return {
      id: data.id,
      type: data.type,
      title: data.title,
      message: data.message,
      platform: data.platform,
      targetUserIds: data.targetUserIds,
      createdBy: data.createdBy,
      createdAt: Number(data.createdAt),
      readBy: data.readBy || []
    };
  },

  async updateNotification(id: string, updates: Partial<AppNotification>): Promise<void> {
    const { error } = await supabase.from('notifications').update(updates).eq('id', id);
    if (error) {
      console.error('Lỗi khi update notification', error);
      throw error;
    }
  }

};
