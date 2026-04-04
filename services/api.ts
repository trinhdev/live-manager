
import { supabase } from './supabase';
import { User, Brand, Shift, Availability, ScheduleItem, ShiftRequest } from '../types';
import { INITIAL_USERS, INITIAL_SHIFTS } from '../constants';

// Helper: map User from DB (snake_case) to App (camelCase)
const mapUser = (u: any): User => ({
  id: u.id,
  name: u.name,
  role: u.role,
  brandId: u.brand_id,
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
        // Filter brand users; exclude SUPER_ADMIN from brand views
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
      zalo_phone: user.zaloPhone,
      is_availability_submitted: user.isAvailabilitySubmitted,
    };
    delete dbUser.brandId;
    delete dbUser.zaloPhone;
    delete dbUser.isAvailabilitySubmitted;

    if (oldId && oldId !== user.id) {
      // Allow modifying the primary key (username/id) through UPDATE
      // Will work if the Supabase ON UPDATE CASCADE constraints are applied via patch
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

  async getShifts(brandId?: string): Promise<Shift[]> {
    try {
      let query = supabase.from('shifts').select('*').order('start_time', { ascending: true });
      if (brandId) query = query.eq('brand_id', brandId);
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase getShifts error:', error.message);
        return [];
      }
      if (!data || data.length === 0) return [];
      return data.map(mapShift).sort((a, b) => a.startTime.localeCompare(b.startTime));
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

  async getSchedule(weekId: string, brandId?: string): Promise<ScheduleItem[]> {
    try {
      let query = supabase.from('schedule').select('*').eq('week_id', weekId);
      if (brandId) query = query.eq('brand_id', brandId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        weekId: item.week_id,
        dayIndex: item.day_index,
        shiftId: item.shift_id,
        brandId: item.brand_id,
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

  async clearSchedule(weekId: string, brandId?: string): Promise<void> {
    let query = supabase.from('schedule').delete().eq('week_id', weekId);
    if (brandId) query = (query as any).eq('brand_id', brandId);
    const { error } = await query;
    if (error) throw error;
  },

  // ─── AVAILABILITY ──────────────────────────────────────────

  async getAvailabilities(weekId: string, brandId?: string): Promise<Availability[]> {
    try {
      let query = supabase.from('availabilities').select('*').eq('week_id', weekId);
      if (brandId) query = query.eq('brand_id', brandId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => ({
        userId: item.user_id,
        weekId: item.week_id,
        dayIndex: item.day_index,
        shiftId: item.shift_id,
        brandId: item.brand_id,
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

  async getRequests(weekId: string, brandId?: string): Promise<ShiftRequest[]> {
    try {
      let query = supabase
        .from('requests')
        .select('*')
        .eq('week_id', weekId)
        .order('created_at', { ascending: false });
      if (brandId) query = query.eq('brand_id', brandId);
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
};
