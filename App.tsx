import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Menu, X, Calendar, Search, Filter, Plus, ChevronLeft, ChevronRight, 
  MapPin, Clock, Users, Sun, Moon, CheckCircle2, ChevronDown, Lock,
  Phone, AlertCircle, RefreshCw, BarChart3, Settings, Play, Image as ImageIcon, Copy, Key, Link as LinkIcon, Trash2, Edit2, Zap, Save, Check, CreditCard, Star, Activity, UserPlus, LogOut, LogIn, Monitor, Smartphone, Video, Camera, Mic, Volume2, Maximize, Minimize, Settings2, Sliders, Bell, MessageSquare, Briefcase, Award, TrendingUp, TrendingDown, Send, PauseCircle, PhoneCall, Inbox, MoreHorizontal,
  ShieldCheck, Sparkles, Wrench, XCircle, History, Info, Layers, ArrowRightLeft, MessageCircle, MousePointer2, CalendarCheck, Mic2, Shield, Gem, Crown, ListTodo, RotateCcw, FileSpreadsheet, Download, Loader2, Palette, Bot, AlertTriangle
} from 'lucide-react';
import { User, Brand, Shift, Availability, ScheduleItem, ViewMode, Rank, Role, ShiftRequest, RequestStatus, RequestType, Platform, AppNotification, NotificationType, TimekeepingRecord } from './types';
import { DAYS_OF_WEEK, PLATFORM_CONFIG, TIKTOK_LOGO_SVG, SHOPEE_LOGO_SVG } from './constants';
import { Button } from './components/Button';
import { DEFAULT_LLM_CONFIG, LlmConfig, testConnection } from './services/llm';
import { Modal } from './components/Modal';
import { LoginPage } from './components/LoginPage';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { SalaryDetailModal } from './components/SalaryDetailModal';
import { ZaloService, ZaloConfig } from './services/zalo';
import { api, sendOneSignalPush } from './services/api';
import { supabase } from './services/supabase';
import { autoGenerateSchedule } from './services/scheduler';
import OneSignal from 'react-onesignal';

// Module-level promise — đảm bảo OneSignal.login() luôn chạy SAU init()
let oneSignalInitPromise: Promise<void> | null = null;

// ── Platform Icon Component ──────────────────────────────────
const PlatformIcon: React.FC<{ platform: Platform; size?: number; className?: string }> = ({ platform, size = 16, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
    style={{ width: size, height: size, color: PLATFORM_CONFIG[platform].color }}
    dangerouslySetInnerHTML={{ __html: platform === 'tiktok' ? TIKTOK_LOGO_SVG : SHOPEE_LOGO_SVG }}
  />
);

// ── Platform Badge Component ──────────────────────────────────
const PlatformBadge: React.FC<{ platform: Platform; size?: 'sm' | 'md' }> = ({ platform, size = 'sm' }) => {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold ${size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[11px]'}`}
      style={{ background: cfg.bgLight, color: cfg.color, border: `1px solid ${cfg.borderColor}` }}>
      <PlatformIcon platform={platform} size={size === 'sm' ? 10 : 13} />
      {cfg.label}
    </span>
  );
};

// Helper: parse brand slug from URL (e.g. /gimmetee → 'gimmetee', / → null)
const getBrandSlugFromURL = (): string | null => {
  const parts = window.location.pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'superadmin') return null;
  return parts[0];
};

// --- Helper Components ---
const RankBadge: React.FC<{ rank?: Rank, size?: 'sm' | 'md' }> = ({ rank, size = 'sm' }) => {
  if (!rank) return null;
  const config = {
    'S': { bg: '#FEF9C3', text: '#854D0E', label: 'Super' },
    'A': { bg: '#F3E8FF', text: '#6B21A8', label: 'Pro' },
    'B': { bg: '#EFF6FF', text: '#1D4ED8', label: 'Active' },
    'C': { bg: '#F5F5F5', text: '#525252', label: 'Newbie' },
  };
  const c = config[rank];
  return (
    <span
      style={{ background: c.bg, color: c.text }}
      className={`inline-flex items-center gap-1 rounded font-semibold border-0 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      {size === 'md' && <span>{c.label}</span>}
      <span>{rank}</span>
    </span>
  );
};

const RoleBadge: React.FC<{ role: Role }> = ({ role }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    'SUPER_ADMIN': { bg: '#171717', text: '#FFFFFF', label: 'Super Admin' },
    'MANAGER': { bg: '#374151', text: '#FFFFFF', label: 'Quản lý' },
    'OPERATIONS': { bg: '#FFF7ED', text: '#C2410C', label: 'Vận hành' },
    'STAFF': { bg: '#EFF6FF', text: '#1D4ED8', label: 'Streamer' },
  };
  const c = config[role] || config['STAFF'];
  return (
    <span
      style={{ background: c.bg, color: c.text }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide"
    >
      {c.label}
    </span>
  );
};

// ── Time Parsers Helper cho tính năng Kẹp Ca ── //
const parseTimeStrToHours = (t: string): number => {
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

const parseDurationFromLabel = (label: string): number | null => {
   if (!label) return null;
   const parts = label.split(/\s*-\s*/);
   if (parts.length === 2) {
      const start = parseTimeStrToHours(parts[0]);
      const end = parseTimeStrToHours(parts[1]);
      if (start > 0 && end > 0) {
         let duration = end - start;
         if (duration < 0) duration += 24; // Qua đêm
         return duration;
      }
   }
   return null;
};

// ── Tính tuần hiện tại trong tháng (1–5) khớp với logic weekDates ──────────
const getCurrentWeekOfMonth = (date: Date = new Date()): number => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const dayOfWeek = startOfMonth.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(startOfMonth);
  firstMonday.setDate(startOfMonth.getDate() + diff);
  const daysDiff = Math.floor((date.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(5, Math.floor(daysDiff / 7) + 1));
};

export default function App() {
  // --- STATE ---

  // ── Brand Routing: parse URL on mount ──────────────────────
  const [activeBrandSlug, setActiveBrandSlug] = useState<string | null>(getBrandSlugFromURL);

  // Navigate to a brand (or back to super admin /)
  const navigateToBrand = (slug: string | null) => {
    const path = slug ? `/${slug}` : '/';
    window.history.pushState({}, '', path);
    setActiveBrandSlug(slug);
    
    // Only reset app state if not super admin, or if super admin is actually logging out
    // If super admin is just switching to a brand, preserve their session
    setUsers([]); setShifts([]); setSchedule([]); setAvailabilities([]); setRequests([]);
    setViewMode('DASHBOARD');
  };

  // System State
  const [isLoading, setIsLoading] = useState(true);
  // LLM (AI) configuration
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => {
    try {
      const raw = localStorage.getItem('ls_llm_config');
      return raw ? JSON.parse(raw) : DEFAULT_LLM_CONFIG;
    } catch {
      return DEFAULT_LLM_CONFIG;
    }
  });
  const [isTestingLLM, setIsTestingLLM] = useState(false);
  useEffect(() => {
    localStorage.setItem('ls_llm_config', JSON.stringify(llmConfig));
  }, [llmConfig]);
  
  // Persistent Login State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ls_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [isLoginPageOpen, setIsLoginPageOpen] = useState(false);
  
  // View Mode: Initialize based on saved user role to restore correct screen on reload
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('ls_user');
      if (saved) {
        const u = JSON.parse(saved);
        // Always default to Dashboard for all roles on first load
        return 'DASHBOARD';
      }
    } catch (e) {}
    return 'DASHBOARD';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  // Platform State
  const [activePlatform, setActivePlatform] = useState<Platform>('tiktok');

  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [notifFormData, setNotifFormData] = useState({ title: '', message: '' });

  // Notification helpers
  const addNotification = async (notif: Omit<AppNotification, 'id' | 'createdAt' | 'readBy'>) => {
    try {
      // Chỉ insert vào DB — Realtime subscription sẽ tự cập nhật UI state
      // Không set state ở đây để tránh duplicate khi cả addNotification và Realtime đều thêm
      await api.createNotification(notif);
    } catch (e) {
      console.error('addNotification failed:', e);
    }
  };


  const markNotifRead = async (notifId: string) => {
    if (!currentUser) return;
    const notif = notifications.find(n => n.id === notifId);
    if (!notif) return;
    const newReadBy = [...new Set([...(notif.readBy || []), currentUser.id])];
    
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, readBy: newReadBy } : n));
    
    try {
      await api.updateNotification(notifId, { readBy: newReadBy });
    } catch (e) {
      console.error(e);
      // Revert if needed (simplified here)
    }
  };

  const markAllNotifsRead = async () => {
    if (!currentUser) return;
    const unreadNotifs = myNotifications.filter(n => !(n.readBy || []).includes(currentUser.id));
    if (unreadNotifs.length === 0) return;

    // Optimistic
    setNotifications(prev => prev.map(n => myNotifications.some(mn => mn.id === n.id) ? { ...n, readBy: [...new Set([...(n.readBy || []), currentUser.id])] } : n));
    
    try {
      await Promise.all(unreadNotifs.map(n => 
        api.updateNotification(n.id, { readBy: [...new Set([...(n.readBy || []), currentUser.id])] })
      ));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return notifications.filter(n => {
      // Brand filter: only count notifications for current brand
      if (activeBrandSlug && n.brandId && n.brandId !== activeBrandSlug) return false;
      const isForMe = !n.targetUserIds || n.targetUserIds.includes(currentUser.id);
      const isRead = (n.readBy || []).includes(currentUser.id);
      return isForMe && !isRead;
    }).length;
  }, [notifications, currentUser, activeBrandSlug]);

  const myNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter(n => {
      // Brand filter: skip notifications from other brands
      if (activeBrandSlug && n.brandId && n.brandId !== activeBrandSlug) return false;
      const isGlobal = !n.targetUserIds || n.targetUserIds.length === 0 || (n.targetUserIds as any) === "{}" || (n.targetUserIds as any) === "[]";
      return isGlobal || 
             (n.targetUserIds && (n.targetUserIds as any).includes(currentUser.id)) || 
             n.createdBy === currentUser.id;
    });
  }, [notifications, currentUser, activeBrandSlug]);

  // Request notification permission sớm nhất có thể (fallback nhanh nếu OneSignal chưa sẵn sàng)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay nhỏ 500ms để tránh xung đột với OneSignal init
      const t = setTimeout(() => Notification.requestPermission(), 500);
      return () => clearTimeout(t);
    }
  }, []);

  // Initialize OneSignal — lưu Promise để login() có thể chời sau khi init xong
  // Trước đây login() chạy song song với init() gây lỗi 'Qe' undefined
  useEffect(() => {
    const ONE_SIGNAL_APP_ID = (import.meta as any).env.VITE_ONESIGNAL_APP_ID;
    if (!ONE_SIGNAL_APP_ID || ONE_SIGNAL_APP_ID === 'CHANGEME_APP_ID') return;
    oneSignalInitPromise = OneSignal.init({
      appId: ONE_SIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerParam: { scope: '/' },
    }).then(() => {
      if (Notification.permission === 'default') {
        const oneSignalAny = OneSignal as any;
        const promptFn = oneSignalAny.showNativePrompt || oneSignalAny.showSlidedownPrompt;
        if (typeof promptFn === 'function') {
          Promise.resolve(promptFn.call(oneSignalAny)).catch(() => {});
        }
      }
    }).catch(err => console.error('OneSignal Init Error:', err));
  }, []);

  // Login OneSignal — chời sau init() để tránh lỗi 'Qe' undefined
  useEffect(() => {
    const ONE_SIGNAL_APP_ID = (import.meta as any).env.VITE_ONESIGNAL_APP_ID;
    if (!ONE_SIGNAL_APP_ID || ONE_SIGNAL_APP_ID === 'CHANGEME_APP_ID') return;
    const userId = currentUser?.id || null;
    // Đợi init() xong rồi mới gọi login/logout
    (oneSignalInitPromise || Promise.resolve()).then(() => {
      if (userId) {
        OneSignal.login(userId).catch(err => console.error('OneSignal Login Error:', err));
      } else {
        OneSignal.logout().catch(() => {});
      }
    });
  }, [currentUser?.id]);

  // Mobile day selector for schedule grid
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const today = new Date();
    const d = today.getDay();
    return d === 0 ? 6 : d - 1; // Mon=0 … Sun=6
  });

  // Date Management
  const [currentDate, setCurrentDate] = useState(new Date());
  // Tự động hiện đúng tuần hiện tại trong tháng khi app khởi động
  const [currentWeek, setCurrentWeek] = useState<number>(() => getCurrentWeekOfMonth(new Date()));

  const getWeekId = (date: Date, week: number) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}-W${week}`;
  };

  const currentWeekId = useMemo(() => getWeekId(currentDate, currentWeek), [currentDate, currentWeek]);

  // Ref giữ currentWeekId mới nhất — cho phép realtime handlers đọc đúng tuần
  // mà không cần đưa currentWeekId vào dependency array (tránh tái tạo channel)
  const currentWeekIdRef = useRef(currentWeekId);
  useEffect(() => { currentWeekIdRef.current = currentWeekId; }, [currentWeekId]);

  // Data State
  const [currentBrand, setCurrentBrand] = useState<Brand | null>(null);
  // Ref để notifications handler luôn có brand name mới nhất (tránh stale closure trong [] effect)
  const currentBrandRef = useRef<Brand | null>(null);
  useEffect(() => { currentBrandRef.current = currentBrand; }, [currentBrand]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);

  // Calculate Dates for the current week
  const weekDates = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const dayOfWeek = startOfMonth.getDay(); 
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const firstMonday = new Date(startOfMonth);
    firstMonday.setDate(startOfMonth.getDate() + diff);
    const startOfCurrentWeek = new Date(firstMonday);
    startOfCurrentWeek.setDate(firstMonday.getDate() + (currentWeek - 1) * 7);
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfCurrentWeek);
        d.setDate(startOfCurrentWeek.getDate() + i);
        dates.push(d);
    }
    return dates;
  }, [currentDate, currentWeek]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const formatDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

  // UI State (Modals, Forms)
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [isEditUser, setIsEditUser] = useState(false);
  const [salaryDetailUser, setSalaryDetailUser] = useState<User | null>(null);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeData, setOvertimeData] = useState<{ userId: string; minutes: number }>({ userId: '', minutes: 0 });

  // Timekeeping state
  const [timekeepingMonth, setTimekeepingMonth] = useState<number>(new Date().getMonth() + 1);
  const [timekeepingYear, setTimekeepingYear] = useState<number>(new Date().getFullYear());
  const [timekeepingRecords, setTimekeepingRecords] = useState<TimekeepingRecord[]>([]);
  const [timekeepingDraft, setTimekeepingDraft] = useState<Record<string, { bonusAmount: number; note: string }>>({});
  const [timekeepingLoading, setTimekeepingLoading] = useState(false);
  const [timekeepingSaving, setTimekeepingSaving] = useState<string | null>(null);
  const [timekeepingTab, setTimekeepingTab] = useState<'summary'|'daily'>('summary');
  const [timekeepingDetailUserId, setTimekeepingDetailUserId] = useState<string | null>(null);
  const [expandedTKDay, setExpandedTKDay] = useState<string | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');


  const [editingSlot, setEditingSlot] = useState<{day: number, shiftId: string} | null>(null);
  const [slotTab, setSlotTab] = useState<'STREAMER' | 'OPS'>('STREAMER');
  const [requestForm, setRequestForm] = useState<{type: RequestType, reason: string, targetUserId?: string, slot?: {day: number, shiftId: string}}>({
    type: 'SWAP',
    reason: ''
  });
  const [shiftFormData, setShiftFormData] = useState<Shift>({ id: '', name: '', startTime: '', endTime: '', color: '', platform: 'tiktok' });
  const [userFormData, setUserFormData] = useState<Partial<User>>({});
  const [oldUserId, setOldUserId] = useState<string>(''); // Used to track ID renaming
  const [bridgeData, setBridgeData] = useState<{
    userId: string;
    startTime: string;
    endTime: string;
    applyToNextShift: boolean;
  }>({ userId: '', startTime: '', endTime: '', applyToNextShift: true });

  // Zalo Settings
  const [zaloConfig, setZaloConfig] = useState<ZaloConfig>(() => {
    const saved = localStorage.getItem('ls_zalo_config');
    // Mặc định lấy Token và ChatID từ hình ảnh Postman bạn gửi
    const defaultToken = '3573748186453674284:QqhpitqfEgbvxrGkJqVRPMhBmXQupppywGMqeHXFqWHkigMkUiUGiCAcWrcNNzCE';
    const defaultGroupId = 'b2a2e14f1801f15fa810';
    
    return saved ? JSON.parse(saved) : { 
      webhookUrl: '', 
      botToken: defaultToken, 
      groupId: defaultGroupId 
    };
  });
  const [isZaloEnabled, setIsZaloEnabled] = useState(true);
  const [isTestingBot, setIsTestingBot] = useState(false);
  
  // Update service when config changes
  useEffect(() => {
    localStorage.setItem('ls_zalo_config', JSON.stringify(zaloConfig));
    ZaloService.setConfig(zaloConfig);
  }, [zaloConfig]);

  // --- INITIAL DATA FETCHING ---
  const fetchData = async () => {
    // Super admin doesn't load brand data directly
    if (!activeBrandSlug) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [brandData, uData, sData, schData, avData, reqData, notifData] = await Promise.all([
        api.getBrand(activeBrandSlug),
        api.getUsers(activeBrandSlug),
        api.getShifts(activeBrandSlug),
        api.getSchedule(currentWeekId, activeBrandSlug),
        api.getAvailabilities(currentWeekId, activeBrandSlug),
        api.getRequests(currentWeekId, activeBrandSlug),
        api.getNotifications(activeBrandSlug || undefined)
      ]);
      setCurrentBrand(brandData);
      setUsers(uData);
      setShifts(sData);
      setSchedule(schData);
      setAvailabilities(avData);
      setRequests(reqData);
      setNotifications(notifData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Platform-filtered derived data ──────────────────────────
  const platformShifts = useMemo(() => shifts.filter(s => s.platform === activePlatform), [shifts, activePlatform]);
  const platformSchedule = useMemo(() => schedule.filter(s => s.platform === activePlatform), [schedule, activePlatform]);
  const platformAvailabilities = useMemo(() => availabilities.filter(a => a.platform === activePlatform), [availabilities, activePlatform]);
  const platformRequests = useMemo(() => requests.filter(r => r.platform === activePlatform), [requests, activePlatform]);
  const platformUsers = useMemo(() => users.filter(u => !u.platforms || u.platforms.includes(activePlatform)), [users, activePlatform]);

  useEffect(() => {
    fetchData();
  }, [currentWeekId, activeBrandSlug]);

  // BUG-007 fix: khi tab được active lại từ background → refresh data để tránh stale
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeBrandSlug) {
        const wid = currentWeekIdRef.current;
        const slug = activeBrandSlug;
        Promise.all([
          api.getSchedule(wid, slug),
          api.getAvailabilities(wid, slug),
          api.getRequests(wid, slug),
          api.getNotifications(slug),
        ]).then(([sch, avs, reqs, notifs]) => {
          setSchedule(sch);
          setAvailabilities(avs);
          setRequests(reqs);
          setNotifications(notifs);
        }).catch(e => console.warn('Visibility refresh failed', e));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeBrandSlug]);

  // Sync currentUser with latest users data to ensure freshness
  useEffect(() => {
    if (currentUser && users.length > 0) {
        const freshUser = users.find(u => u.id === currentUser.id);
        if (freshUser) {
            // Check for differences to avoid unnecessary renders/writes
            const currentStr = JSON.stringify(currentUser);
            const freshStr = JSON.stringify(freshUser);
            if (currentStr !== freshStr) {
                setCurrentUser(freshUser);
                localStorage.setItem('ls_user', freshStr);
            }
        }
    }
  }, [users, currentUser]);

  // Realtime Notifications Subscription
  useEffect(() => {
    if (!('channel' in supabase)) return; // Offline mode handling

    const channel = (supabase as any).channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        const n = payload.new;
        const newNotif: AppNotification = { 
          id: n.id, type: n.type, title: n.title, message: n.message, platform: n.platform, 
          brandId: n.brand_id, targetUserIds: n.targetUserIds, createdBy: n.createdBy, createdAt: Number(n.createdAt), readBy: n.readBy || [] 
        };
        
        // Skip notifications from other brands
        const lsBrandSlug = getBrandSlugFromURL();
        if (lsBrandSlug && newNotif.brandId && newNotif.brandId !== lsBrandSlug) return;
        
        setNotifications((prev: AppNotification[]) => {
            if (prev.some(x => x.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
        });
        
        // Hiển thị browser notification nếu có quyền và đúng người nhận
        if ('Notification' in window && Notification.permission === 'granted') {
          const lsUser = localStorage.getItem('ls_user');
          const userObj = lsUser ? JSON.parse(lsUser) : null;
          const targets = newNotif.targetUserIds;
          // Kiểm tra đúng kiểu Array — trước đây so sánh array với string nên luôn false
          const isGlobal = !targets || (Array.isArray(targets) && targets.length === 0);
          const isForMe = isGlobal || (Array.isArray(targets) && targets.includes(userObj?.id || ''));
          if (isForMe) {
            const appName = currentBrandRef.current?.name || 'LiveSync'; // Dùng ref, lúc nào cũng đúng
            try {
              new Notification(newNotif.title, { body: newNotif.message, icon: '/icon.jpg', tag: newNotif.id });
            } catch(e) { console.warn('Browser notification failed:', e); }
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload: any) => {
          const n = payload.new;
          setNotifications((prev: AppNotification[]) => prev.map(old => old.id === n.id ? { ...old, readBy: n.readBy || [] } : old));
      })
      .subscribe((status: string, err?: Error) => {
        if (err) console.warn('Notifications channel error:', err);
        if (status !== 'SUBSCRIBED') return;
        // Khi WebSocket kết nối lại (ví dụ: mở màn hình điện thoại), fetch lại thông báo bị nhỡ
        const slug = getBrandSlugFromURL();
        api.getNotifications(slug || undefined).then(freshNotifs => {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const missed = freshNotifs.filter(n => !existingIds.has(n.id));
            if (missed.length === 0) return prev;
            // Hiển browser notification cho các thông báo bị nhỡ chưa đọc
            if ('Notification' in window && Notification.permission === 'granted') {
              const lsUser = localStorage.getItem('ls_user');
              const u = lsUser ? JSON.parse(lsUser) : null;
              const appName = currentBrandRef.current?.name || 'LiveSync';
              missed.forEach(notif => {
                const targets = notif.targetUserIds;
                const forMe = !targets || (Array.isArray(targets) && (targets.length === 0 || targets.includes(u?.id || '')));
                const unread = !(notif.readBy || []).includes(u?.id || '');
                if (forMe && unread) {
                  try { new Notification(notif.title, { body: notif.message, icon: '/icon.jpg', tag: notif.id }); } catch(_) {}
                }
              });
            }
            return [...missed, ...prev];
          });
        }).catch(e => console.warn('Notification reconnect refresh failed', e));
      });

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  // Realtime Subscription — channel chỉ tái tạo khi đổi brand, KHÔNG tái tạo khi đổi tuần.
  // Dùng currentWeekIdRef để handlers luôn đọc được tuần đúng mà không gây stale closure.
  useEffect(() => {
    if (!('channel' in supabase)) return;
    if (!activeBrandSlug) return;

    const realtimeChannel = (supabase as any)
      .channel(`realtime_data_${activeBrandSlug}`) // Không có currentWeekId trong tên
      // ── Schedule changes ──────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, async (payload: any) => {
        const lsBrandSlug = getBrandSlugFromURL();
        if (!lsBrandSlug) return;
        const row = payload.new || payload.old || {};
        if (row.brand_id && row.brand_id !== lsBrandSlug) return;
        const lsWeekId = currentWeekIdRef.current; // ← Luôn là giá trị mới nhất
        try {
          const freshSchedule = await api.getSchedule(lsWeekId, lsBrandSlug);
          setSchedule(freshSchedule);
        } catch(e) { console.warn('Realtime schedule refresh failed', e); }
      })
      // ── Users changes ─────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async (payload: any) => {
        const lsBrandSlug = getBrandSlugFromURL();
        if (!lsBrandSlug) return;
        const row = payload.new || payload.old || {};
        if (row.brand_id && row.brand_id !== lsBrandSlug) return;
        try {
          const freshUsers = await api.getUsers(lsBrandSlug);
          setUsers(freshUsers);
        } catch(e) { console.warn('Realtime users refresh failed', e); }
      })
      // ── Availabilities changes ────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities' }, async (payload: any) => {
        const lsBrandSlug = getBrandSlugFromURL();
        if (!lsBrandSlug) return;
        const row = payload.new || payload.old || {};
        if (row.brand_id && row.brand_id !== lsBrandSlug) return;
        const lsWeekId = currentWeekIdRef.current; // ← Luôn là giá trị mới nhất
        try {
          const freshAv = await api.getAvailabilities(lsWeekId, lsBrandSlug);
          setAvailabilities(freshAv);
        } catch(e) { console.warn('Realtime availabilities refresh failed', e); }
      })
      // ── Requests changes ──────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, async (payload: any) => {
        const lsBrandSlug = getBrandSlugFromURL();
        if (!lsBrandSlug) return;
        const row = payload.new || payload.old || {};
        if (row.brand_id && row.brand_id !== lsBrandSlug) return;
        const lsWeekId = currentWeekIdRef.current;
        try {
          const freshRequests = await api.getRequests(lsWeekId, lsBrandSlug);
          setRequests(freshRequests);
        } catch(e) { console.warn('Realtime requests refresh failed', e); }
      })
      // ── Shifts changes ────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, async (payload: any) => {
        const lsBrandSlug = getBrandSlugFromURL();
        if (!lsBrandSlug) return;
        const row = payload.new || payload.old || {};
        if (row.brand_id && row.brand_id !== lsBrandSlug) return;
        try {
          const freshShifts = await api.getShifts(lsBrandSlug);
          setShifts(freshShifts);
        } catch(e) { console.warn('Realtime shifts refresh failed', e); }
      })
      .subscribe((status: string, err?: Error) => {
        if (err) console.warn('Realtime channel error:', err);
        if (status !== 'SUBSCRIBED') return;
        // Khi WebSocket kết nối lại (ví dụ: điện thoại mở màn hình sau khi off),
        // re-fetch data để bắt kịp những thay đổi bị nhỡ trong lúc offline
        const slug = getBrandSlugFromURL();
        if (!slug) return;
        const wid = currentWeekIdRef.current;
        Promise.all([
          api.getSchedule(wid, slug),
          api.getAvailabilities(wid, slug),
          api.getRequests(wid, slug),
        ]).then(([sch, avs, reqs]) => {
          setSchedule(sch);
          setAvailabilities(avs);
          setRequests(reqs);
        }).catch(e => console.warn('Reconnect data refresh failed', e));
      });

    return () => {
      (supabase as any).removeChannel(realtimeChannel);
    };
  }, [activeBrandSlug]); // Chỉ tái tạo khi đổi brand — KHÔNG tái tạo khi đổi tuần

  // Auto-load timekeeping bonus records when entering TIMEKEEPING view or month/year changes
  useEffect(() => {
    if (viewMode !== 'TIMEKEEPING' || !activeBrandSlug) return;
    let cancelled = false;
    (async () => {
      setTimekeepingLoading(true);
      try {
        const recs = await api.getTimekeeping(activeBrandSlug, timekeepingMonth, timekeepingYear);
        if (cancelled) return;
        setTimekeepingRecords(recs);
        const draft: Record<string,{bonusAmount:number;note:string}> = {};
        recs.forEach(r => { draft[r.userId]={bonusAmount:r.bonusAmount,note:r.note||''}; });
        setTimekeepingDraft(draft);
      } catch(e) { console.error('Auto-load timekeeping failed', e); }
      finally { if (!cancelled) setTimekeepingLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [viewMode, activeBrandSlug, timekeepingMonth, timekeepingYear]);

  // --- Derived Data ---
  const currentWeekSchedule = useMemo(() => platformSchedule, [platformSchedule]);
  const currentWeekAvailabilities = useMemo(() => platformAvailabilities, [platformAvailabilities]);
  const currentWeekRequests = useMemo(() => platformRequests, [platformRequests]);
  const canManageRequests = currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN';
  const pendingCount = useMemo(() => requests.filter(r => r.status === 'PENDING' && r.platform === activePlatform).length, [requests, activePlatform]);
  const staffUsers = useMemo(() => users.filter(u => u.role !== 'MANAGER'), [users]);
  const submittedCount = useMemo(() => staffUsers.filter(u => u.isAvailabilitySubmitted).length, [staffUsers]);

  const monthlyStats = useMemo(() => {
    return users.filter(u => u.role !== 'MANAGER').map(u => {
       let shiftCount = 0;
       let totalHours = 0;
       
       schedule.forEach(s => {
           const sa = s.streamerAssignments.find(x => x.userId === u.id);
           const isOps = s.opsUserId === u.id;
           
           if (sa || isOps) {
               shiftCount++;
               let hours = 0;
               
               // Ưu tiên đọc giờ Kẹp Ca nếu có cấu hình (ví dụ "19h - 21h")
               if (sa && sa.timeLabel) {
                   const customHours = parseDurationFromLabel(sa.timeLabel);
                   if (customHours !== null) {
                       hours = customHours;
                   }
               }
               
               // Nếu không có Kẹp Ca / Không parse được / Là OPS -> Tính theo giờ gốc của Shift
               if (hours === 0) {
                   const shiftDef = shifts.find(def => def.id === s.shiftId);
                   if (shiftDef) {
                       const start = parseTimeStrToHours(shiftDef.startTime);
                       const end = parseTimeStrToHours(shiftDef.endTime);
                       if (start > 0 && end > 0) {
                           let duration = end - start;
                           if (duration < 0) duration += 24;
                           hours = duration;
                       }
                   }
               }
               
               // Fallback an toàn nếu lỗi hoàn toàn
               if (hours === 0) hours = 4;
               
               totalHours += hours;
           }
       });
       
       return { ...u, shiftCount, totalHours };
    }).sort((a,b) => b.shiftCount - a.shiftCount);
  }, [schedule, users, shifts]);


  // --- ACTIONS ---

  const handleLogin = (user: User) => {
    // Validate brand context
    if (user.role === 'SUPER_ADMIN') {
      // Super admin can only login at root
      if (activeBrandSlug) {
        alert('Tài khoản Super Admin chỉ đăng nhập tại trang gốc (/).');
        return;
      }
    } else {
      // Brand users must match the current brand slug
      if (!activeBrandSlug) {
        alert('Vui lòng truy cập qua URL của brand, ví dụ: /gimmetee');
        return;
      }
      if (user.brandId && user.brandId !== activeBrandSlug) {
        alert(`Tài khoản này thuộc brand khác, không thể đăng nhập tại /${activeBrandSlug}.`);
        return;
      }
    }
    setCurrentUser(user);
    localStorage.setItem('ls_user', JSON.stringify(user));
    setIsLoginPageOpen(false);
    if (user.role === 'SUPER_ADMIN') {
      setViewMode('DASHBOARD');
    } else {
      setViewMode('DASHBOARD');
    }
  };

  const handleLogout = () => {
    // If super admin is viewing a brand, "Logout" just means going back to root panel
    if (currentUser?.role === 'SUPER_ADMIN' && activeBrandSlug) {
      navigateToBrand(null);
      return;
    }

    setCurrentUser(null);
    localStorage.removeItem('ls_user');
    setViewMode('DASHBOARD');
    setIsMobileMenuOpen(false);
  };

  const checkAuth = (action: () => void) => {
      if (currentUser) {
          action();
      } else {
          if (confirm('Bạn cần đăng nhập để sử dụng tính năng này. Đăng nhập ngay?')) {
              setIsLoginPageOpen(true);
          }
      }
  };

  // --- Logic with API Calls ---

  const toggleAvailability = async (dayIndex: number, shiftId: string) => {
    if (!currentUser) return;

    // Optimistic UI: cập nhật state local NGAY LẬP TỨC
    const exists = availabilities.some(
      a => a.userId === currentUser.id && a.dayIndex === dayIndex && a.shiftId === shiftId
    );

    if (exists) {
      setAvailabilities(prev => prev.filter(
        a => !(a.userId === currentUser.id && a.dayIndex === dayIndex && a.shiftId === shiftId && a.platform === activePlatform)
      ));
    } else {
      setAvailabilities(prev => [...prev, {
        userId: currentUser.id,
        weekId: currentWeekId,
        dayIndex,
        shiftId,
        platform: activePlatform
      }]);
    }

    // Sync to backend (fire and forget — không block UI)
    try {
      await api.toggleAvailability({ userId: currentUser.id, dayIndex, shiftId, weekId: currentWeekId, brandId: activeBrandSlug || undefined, platform: activePlatform });
    } catch (e) {
      console.warn('Backend offline — đã lưu local.');
    }
  };

  const handleSubmitAvailability = async () => {
    if (!currentUser) return;

    // Optimistic: cập nhật local trước
    const updatedUser = { ...currentUser, isAvailabilitySubmitted: true };
    setCurrentUser(updatedUser);
    setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
    localStorage.setItem('ls_user', JSON.stringify(updatedUser));

    // Sync to backend
    try {
      await api.updateUser({ id: currentUser.id, isAvailabilitySubmitted: true });
      // Notify managers
      const managerIds = users.filter(u => u.role === 'MANAGER').map(u => u.id);
      addNotification({
        type: 'AVAILABILITY_REGISTERED',
        title: 'Đăng ký lịch rảnh mới',
        message: `${currentUser.name} đã đăng ký lịch rảnh cho ${PLATFORM_CONFIG[activePlatform].label} tuần ${currentWeek}.`,
        platform: activePlatform,
        brandId: activeBrandSlug || undefined,
        targetUserIds: managerIds,
        createdBy: currentUser.id,
      });
      alert('✅ Đã gửi đăng ký thành công! Admin sẽ nhận được thông báo.');
    } catch (e: any) {
      // Rollback optimistic update nếu lỗi
      setCurrentUser(currentUser);
      setUsers(users.map(u => u.id === currentUser.id ? currentUser : u));
      localStorage.setItem('ls_user', JSON.stringify(currentUser));
      alert(`❌ Gửi đăng ký thất bại: ${e?.message || e}\n\nVui lòng thử lại.`);
    }
  };


  const handleAutoSchedule = async () => {
    const rawItems = autoGenerateSchedule(users, shifts, availabilities, schedule, currentWeekId, activePlatform);
    // Inject brandId into every generated item (scheduler.ts không có context brand)
    const newItems = rawItems.map(item => ({
      ...item,
      brandId: activeBrandSlug || undefined,
    }));
    setIsLoading(true);
    try {
        await api.clearSchedule(currentWeekId, activeBrandSlug || undefined, activePlatform);
        for (const item of newItems) {
            await api.saveScheduleItem(item);
        }
        // Merge: giữ lịch của platform khác, chỉ cập nhật platform đang chọn
        setSchedule(prev => [
          ...prev.filter(s => !(s.weekId === currentWeekId && s.platform === activePlatform)),
          ...newItems
        ]);
    } catch(e) {
        console.error(e);
        alert("Lỗi lưu lịch tự động");
    } finally {
        setIsLoading(false);
    }
  };

  const createRequest = async () => {
    if (!currentUser) return;
    if (!requestForm.slot) {
      alert('Hãy chọn đúng ca của bạn trong lịch làm việc để gửi yêu cầu.');
      return;
    }

    const requestSlot = requestForm.slot;
    const shift = shifts.find(s => s.id === requestSlot.shiftId);
    const currentSlot = currentWeekSchedule.find(
      s => s.dayIndex === requestSlot.day && s.shiftId === requestSlot.shiftId && s.weekId === currentWeekId
    );

    if (!shift || !currentSlot) {
      alert('Ca này không còn tồn tại hoặc đã thay đổi. Vui lòng kiểm tra lại lịch.');
      return;
    }

    const isAssignedStreamer = currentSlot.streamerAssignments.some(sa => sa.userId === currentUser.id);
    const isAssignedOps = currentSlot.opsUserId === currentUser.id;
    if (!isAssignedStreamer && !isAssignedOps) {
      alert('Bạn chỉ có thể gửi yêu cầu cho ca hiện đang được phân công cho mình.');
      return;
    }

    const isSwap = requestForm.type === 'SWAP';
    if (isSwap && !requestForm.targetUserId) {
      alert('Vui lòng chọn người nhận đổi ca.');
      return;
    }

    const targetRole = currentUser.role === 'OPERATIONS' ? 'OPERATIONS' : 'STAFF';
    const targetUser = users.find(u => u.id === requestForm.targetUserId && u.role === targetRole);

    if (isSwap && !targetUser) {
      alert('Người nhận đổi ca không hợp lệ cho loại ca này.');
      return;
    }

    if (isSwap) {
      const targetAlreadyAssigned = currentSlot.streamerAssignments.some(sa => sa.userId === requestForm.targetUserId) || currentSlot.opsUserId === requestForm.targetUserId;
      if (targetAlreadyAssigned) {
        alert('Người này đã có trong ca hiện tại.');
        return;
      }
    }

    const newReq: ShiftRequest = {
      id: `req-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      type: requestForm.type,
      dayIndex: requestForm.slot.day,
      shiftId: requestForm.slot.shiftId,
      weekId: currentWeekId,
      brandId: activeBrandSlug || undefined,
      platform: activePlatform,
      reason: requestForm.reason,
      targetUserId: requestForm.targetUserId,
      targetUserName: targetUser?.name,
      status: 'PENDING',
      createdAt: Date.now()
    };
    
    try {
        await api.createRequest(newReq);
        setRequests([newReq, ...requests]);
        setIsRequestModalOpen(false);
        // Notify managers and the target user (if SWAP) about new request
        const managerIds = users.filter(u => u.role === 'MANAGER').map(u => u.id);
        const notifyTargetIds = newReq.targetUserId 
          ? [...managerIds, newReq.targetUserId] 
          : managerIds;

        addNotification({
          type: 'REQUEST_NEW',
          title: 'Yêu cầu mới',
          message: `${currentUser.name} ${newReq.type === 'LEAVE' ? 'xin nghỉ' : 'xin đổi'} ca ${shifts.find(s => s.id === newReq.shiftId)?.name || ''} ngày ${DAYS_OF_WEEK[newReq.dayIndex]}.${newReq.targetUserId ? ` (Đổi ca với ${newReq.targetUserName})` : ''}`,
          platform: activePlatform,
          brandId: activeBrandSlug || undefined,
          targetUserIds: notifyTargetIds,
          createdBy: currentUser.id,
        });
    } catch (e) {
        alert("Lỗi gửi yêu cầu");
    }
  };

  const handleProcessRequest = async (reqId: string, status: RequestStatus) => {
    try {
        const req = requests.find(r => r.id === reqId);
        if (!req) return;

        if (status === 'APPROVED') {
            const freshSchedule = await api.getSchedule(req.weekId, activeBrandSlug || undefined);
            const existingItem = freshSchedule.find(s =>
              s.dayIndex === req.dayIndex &&
              s.shiftId === req.shiftId &&
              s.weekId === req.weekId &&
              s.platform === req.platform
            );
            if (!existingItem) {
                alert('Không tìm thấy ca cần xử lý. Có thể lịch đã thay đổi, vui lòng tải lại và kiểm tra lại.');
                return;
            }

            let newItem = { ...existingItem, streamerAssignments: [...existingItem.streamerAssignments] };
            if (req.type === 'LEAVE') {
                newItem.streamerAssignments = newItem.streamerAssignments.filter(sa => sa.userId !== req.userId);
                if (newItem.opsUserId === req.userId) newItem.opsUserId = null;
            } else if (req.type === 'SWAP') {
                if (!req.targetUserId) {
                    alert('Yêu cầu đổi ca thiếu người nhận đổi.');
                    return;
                }

                const targetUserId = req.targetUserId;
                const targetAlreadyAssigned = newItem.streamerAssignments.some(sa => sa.userId === targetUserId) || newItem.opsUserId === targetUserId;
                if (targetAlreadyAssigned) {
                    alert('Người nhận đổi đã có trong ca này.');
                    return;
                }

                if (newItem.opsUserId === req.userId) newItem.opsUserId = targetUserId;
                newItem.streamerAssignments = newItem.streamerAssignments.map(sa =>
                    sa.userId === req.userId ? { ...sa, userId: targetUserId } : sa
                );
            }

            const requesterStillAssigned = newItem.streamerAssignments.some(sa => sa.userId === req.userId) || newItem.opsUserId === req.userId;
            if (requesterStillAssigned) {
                alert('Không thể áp dụng yêu cầu vì ca hiện tại không khớp với dữ liệu mới nhất.');
                return;
            }

            await api.saveScheduleItem(newItem);
            // Chỉ refresh schedule UI nếu đang xem đúng tuần của request
            if (req.weekId === currentWeekId) {
              const newSch = await api.getSchedule(currentWeekId, activeBrandSlug || undefined);
              setSchedule(newSch);
            }
        }

        await api.updateRequestStatus(reqId, status);
        const newReqs = await api.getRequests(req.weekId, activeBrandSlug || undefined);
        setRequests(newReqs);

        // Notify the requesting user
        const notifTargets = [req.userId];
        if (req.targetUserId) notifTargets.push(req.targetUserId);
        addNotification({
          type: status === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
          title: status === 'APPROVED' ? 'Yêu cầu đã duyệt ✅' : 'Yêu cầu bị từ chối ❌',
          message: `Yêu cầu ${req.type === 'LEAVE' ? 'nghỉ ca' : 'đổi ca'} ${shifts.find(s => s.id === req.shiftId)?.name || ''} ngày ${DAYS_OF_WEEK[req.dayIndex]} đã ${status === 'APPROVED' ? 'được duyệt' : 'bị từ chối'}.`,
          platform: req.platform,
          brandId: activeBrandSlug || undefined,
          targetUserIds: notifTargets,
          createdBy: currentUser?.id,
        });

    } catch (e) {
        alert("Lỗi xử lý yêu cầu");
    }
  };

  const toggleStreamerInSlot = async (userId: string) => {
    if (!editingSlot) return;
    const existingItem = schedule.find(s => s.dayIndex === editingSlot.day && s.shiftId === editingSlot.shiftId && s.weekId === currentWeekId);
    
    let newItem: ScheduleItem;
    
    if (existingItem) {
        // BUG FIX: Deep copy streamerAssignments để tránh mutate mảng gốc qua splice()
        const assignmentsCopy = existingItem.streamerAssignments.map(a => ({ ...a }));
        const idx = assignmentsCopy.findIndex(s => s.userId === userId);
        if (idx > -1) {
            assignmentsCopy.splice(idx, 1);
        } else {
            if (assignmentsCopy.length >= 2) return alert('Tối đa 2 Streamer!');
            assignmentsCopy.push({ userId });
        }
        newItem = { ...existingItem, streamerAssignments: assignmentsCopy };
    } else {
        newItem = {
            id: `${currentWeekId}-${activePlatform}-${editingSlot.day}-${editingSlot.shiftId}`,
            dayIndex: editingSlot.day,
            shiftId: editingSlot.shiftId,
            weekId: currentWeekId,
            brandId: activeBrandSlug || undefined,
            platform: activePlatform,
            streamerAssignments: [{ userId }],
            opsUserId: null
        };
    }

    try {
        if (newItem.streamerAssignments.length === 0 && !newItem.opsUserId) {
            await api.deleteScheduleItem(newItem.id);
            setSchedule(prev => prev.filter(s => s.id !== newItem.id));
        } else {
            await api.saveScheduleItem(newItem);
            const saved = await api.getSchedule(currentWeekId, activeBrandSlug || undefined);
            setSchedule(saved);
        }
    } catch(e) { console.error(e); }
  };

  const setOpsInSlot = async (userId: string | null) => {
    if (!editingSlot) return;
    const existingItem = schedule.find(s => s.dayIndex === editingSlot.day && s.shiftId === editingSlot.shiftId && s.weekId === currentWeekId);
    
    let newItem: ScheduleItem;
    if (existingItem) {
        newItem = { ...existingItem, opsUserId: userId };
    } else {
        if (!userId) return; 
        newItem = {
            id: `${currentWeekId}-${activePlatform}-${editingSlot.day}-${editingSlot.shiftId}`,
            dayIndex: editingSlot.day,
            shiftId: editingSlot.shiftId,
            weekId: currentWeekId,
            platform: activePlatform,
            streamerAssignments: [],
            opsUserId: userId
        };
    }

    try {
        if (newItem.streamerAssignments.length === 0 && !newItem.opsUserId) {
            await api.deleteScheduleItem(newItem.id);
            setSchedule(schedule.filter(s => s.id !== newItem.id));
        } else {
            await api.saveScheduleItem(newItem);
            const saved = await api.getSchedule(currentWeekId, activeBrandSlug || undefined);
            setSchedule(saved);
        }
    } catch(e) { console.error(e); }
  };

  const handleSaveBridge = async () => {
      if (!editingSlot || !bridgeData.userId) return;
      
      const tLabel = (bridgeData.startTime && bridgeData.endTime) 
          ? `${bridgeData.startTime} - ${bridgeData.endTime}` 
          : '';

      const existingItem = schedule.find(s => s.dayIndex === editingSlot.day && s.shiftId === editingSlot.shiftId && s.platform === activePlatform);
      
      if (!existingItem) {
          alert('Không tìm thấy ca trực. Hãy gán nhân sự vào ca trước khi cấu hình kẹp ca!');
          return;
      }
      
      const newAssignments = existingItem.streamerAssignments.map(sa => {
          if (sa.userId === bridgeData.userId) {
              const copy = { ...sa };
              if (tLabel === '') {
                 delete copy.timeLabel;
              } else {
                 copy.timeLabel = tLabel;
              }
              return copy;
          }
          return sa;
      });
      
      const newItem = { ...existingItem, streamerAssignments: newAssignments };
      
      try {
          await api.saveScheduleItem(newItem);
          const saved = await api.getSchedule(currentWeekId, activeBrandSlug || undefined);
          setSchedule(saved);
          handleCloseBridgeModal();
      } catch (e: any) {
          console.error(e);
          alert('Lỗi lưu cấu hình: ' + e.message);
      }
  };

  // --- User Management ---
  const handleSaveUser = async () => {
      if (!userFormData.name || !userFormData.id || !userFormData.password) {
        alert("Vui lòng nhập đầy đủ Tên, Mã nhân viên và Mật khẩu!");
        return;
      }
      try {
          const userWithBrand = { ...userFormData as User, brandId: userFormData.brandId || activeBrandSlug || undefined };
          const user = await api.updateUser(userWithBrand, oldUserId || undefined);
          setUsers(prev => {
            const list = prev.filter(u => u.id !== oldUserId);
            return [...list, user];
          });
          setIsUserModalOpen(false);
      } catch (e: any) { alert("Lỗi lưu user: " + e.message); }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm("Xóa nhân sự?")) {
          try {
              await api.deleteUser(id);
              setUsers(users.filter(u => u.id !== id));
          } catch(e) { alert("Lỗi xóa"); }
      }
  };

  const handleResetAvailability = async (id: string) => {
      if (confirm("Mở lại form đăng ký lịch rảnh (reset) cho nhân sự này?")) {
          try {
              await api.updateUser({ id, isAvailabilitySubmitted: false });
              setUsers(users.map(u => u.id === id ? { ...u, isAvailabilitySubmitted: false } : u));
          } catch(e) { alert("Lỗi mở lại form"); }
      }
  };

  const handleOpenUserModal = (u?: User) => {
      setIsEditUser(!!u);
      setOldUserId(u?.id || '');
      setUserFormData(u || { id: '', role: 'STAFF', rank: 'C', password: '123', brandId: activeBrandSlug || undefined, platforms: ['tiktok'] });
      setIsUserModalOpen(true);
  };

  // --- Shift Management ---
  const handleSaveShift = async () => {
    if (!shiftFormData.id || !shiftFormData.name || !shiftFormData.startTime || !shiftFormData.endTime) {
      alert("Vui lòng nhập đủ thông tin ca!");
      return;
    }
    try {
      const saved = await api.updateShift(shiftFormData, activeBrandSlug || undefined);
      // Update local state
      const idx = shifts.findIndex(s => s.id === saved.id);
      if (idx > -1) {
        const newShifts = [...shifts];
        newShifts[idx] = saved;
        setShifts(newShifts.sort((a,b) => a.startTime.localeCompare(b.startTime)));
      } else {
        setShifts([...shifts, saved].sort((a,b) => a.startTime.localeCompare(b.startTime)));
      }
      setIsShiftModalOpen(false);
    } catch (e) { alert("Lỗi lưu ca làm việc"); }
  };

  const handleDeleteShift = async (id: string) => {
    if (confirm("Xóa ca làm việc này? Lịch làm việc liên quan sẽ bị ảnh hưởng.")) {
      try {
        await api.deleteShift(id);
        setShifts(shifts.filter(s => s.id !== id));
      } catch (e) { alert("Lỗi xóa ca"); }
    }
  };

  const handleOpenShiftModal = (s?: Shift) => {
    setShiftFormData(s || { id: '', name: '', startTime: '', endTime: '', color: 'bg-slate-100 text-slate-800 border-slate-200', platform: activePlatform });
    setIsShiftModalOpen(true);
  };


  // Handle Export (Mock)
  const handleExportExcel = () => { alert("Đang tải xuống báo cáo..."); };
  const handleCloseBridgeModal = () => { setIsBridgeModalOpen(false); setIsSlotModalOpen(true); };

  const handleSaveOvertime = async () => {
    if (!editingSlot || !overtimeData.userId) return;
    const existingItem = schedule.find(s => s.dayIndex === editingSlot.day && s.shiftId === editingSlot.shiftId && s.platform === activePlatform);
    if (!existingItem) { alert('Không tìm thấy ca trực!'); return; }
    const newAssignments = existingItem.streamerAssignments.map(sa => {
      if (sa.userId === overtimeData.userId) {
        const copy = { ...sa };
        if (overtimeData.minutes > 0) {
          copy.overtimeMinutes = overtimeData.minutes;
        } else {
          delete copy.overtimeMinutes;
        }
        return copy;
      }
      return sa;
    });
    const newItem = { ...existingItem, streamerAssignments: newAssignments };
    try {
      await api.saveScheduleItem(newItem);
      const saved = await api.getSchedule(currentWeekId, activeBrandSlug || undefined);
      setSchedule(saved);
      setIsOvertimeModalOpen(false);
      setIsSlotModalOpen(true);
    } catch (e: any) {
      alert('Lỗi lưu thêm giờ: ' + e.message);
    }
  };
  const handleOpenBridgeModal = (uid: string) => { 
      let st = '';
      let et = '';
      if (editingSlot) {
         const existingItem = schedule.find(s => s.dayIndex === editingSlot.day && s.shiftId === editingSlot.shiftId && s.platform === activePlatform);
         const sa = existingItem?.streamerAssignments.find(x => x.userId === uid);
         if (sa?.timeLabel) {
            const parts = sa.timeLabel.split(/\s*-\s*/);
            if (parts.length === 2) {
               st = parts[0]; et = parts[1];
            }
         }
      }
      setBridgeData({ userId: uid, startTime: st, endTime: et, applyToNextShift: true }); 
      setIsSlotModalOpen(false); 
      setIsBridgeModalOpen(true); 
  };

  const handleTestBot = async () => {
    setIsTestingBot(true);
    try {
        const result = await ZaloService.testConnection(zaloConfig);
        if (result.success) {
            alert("✅ KẾT NỐI THÀNH CÔNG!\nTin nhắn test đã được gửi đến nhóm Zalo.");
        } else {
            alert(`❌ KẾT NỐI THẤT BẠI!\nChi tiết lỗi: ${result.message}\n\nHãy kiểm tra lại:\n1. URL Webhook có chính xác không?\n2. Biến môi trường ZALO_BOT_TOKEN trên server đã đúng chưa?`);
        }
    } catch (e) {
        alert("Lỗi không xác định: " + e);
    } finally {
        setIsTestingBot(false);
    }
  };

  // --- RENDER ---

  // ── Super Admin at root (/) ──────────────────────────────────
  if (!activeBrandSlug) {
    // Not logged in → show super admin login
    if (!currentUser) {
      return <LoginPage
        onLogin={handleLogin}
        users={[]} // will validate against all users in DB
        loading={isLoading}
        onBack={() => {}}
        isSuperAdminLogin={true}
      />;
    }
    // Logged in as super admin → show super admin panel
    if (currentUser.role === 'SUPER_ADMIN') {
      return <SuperAdminPanel
        currentUser={currentUser}
        onNavigateToBrand={(slug) => {
          navigateToBrand(slug);
        }}
        onLogout={handleLogout}
      />;
    }
    // Non-super-admin somehow at root → send to login
    handleLogout();
    return null;
  }

  // ── Brand context: normal app flow ───────────────────────────
  if (isLoginPageOpen) {
    return <LoginPage onLogin={handleLogin} users={users} loading={isLoading} onBack={() => setIsLoginPageOpen(false)} brandSlug={activeBrandSlug} />;
  }

  return (
    <>
      <div className="aurora-mesh">
          <div className="blob-1"></div>
          <div className="blob-2"></div>
          <div className="blob-3"></div>
      </div>
      <div className="min-h-screen flex flex-col md:flex-row font-sans pb-20 md:pb-0 relative z-10 text-[#262626]">
      {/* ── MOBILE TOP BAR (sạch sẽ, không hamburger) ── */}
      <header className="md:hidden sticky top-0 z-40 px-5 pt-10 pb-4 bg-gradient-to-b from-white/80 to-transparent backdrop-blur-[2px]">
        <div className="flex justify-between items-center">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-[#1A1A1A] truncate">{currentBrand ? currentBrand.name : 'LiveSync'}</h1>
            <p className="text-[11px] font-light text-[#A3A3A3] mt-0.5">{currentUser ? currentUser.name : 'Chưa đăng nhập'}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {currentUser && (
              <button onClick={() => setIsNotifPanelOpen(true)} className="relative w-10 h-10 flex items-center justify-center btn-surface border border-white/80 shadow-soft text-[#262626]">
                <Bell size={18} strokeWidth={1.5} />
                {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></span>}
              </button>
            )}
            {!currentUser && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsLoginPageOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 btn-surface border border-white/80 shadow-soft text-[#262626]"
                >
                  <LogIn size={14} strokeWidth={1.5} /> <span className="text-[12px] font-medium">Đăng nhập</span>
                </button>
                <button
                  onClick={() => (window.location.href = '/huong-dan.html')}
                  className="flex items-center gap-1.5 px-3 py-2 btn-surface border border-white/80 shadow-soft text-[#262626]"
                >
                  <Info size={14} strokeWidth={1.5} /> <span className="text-[12px] font-medium">Hướng dẫn</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col z-30 bg-white/60 backdrop-blur-3xl overflow-y-auto shadow-soft border-r border-[#FFFFFF]">
        {/* Logo */}
        <div className="px-6 pt-10 pb-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            {currentBrand?.logoUrl ? (
              <img src={currentBrand.logoUrl} className="w-8 h-8 rounded-xl object-cover shadow-sm" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-medium" style={{background: currentBrand?.color || '#171717'}}>{currentBrand ? currentBrand.name.substring(0, 2).toUpperCase() : 'LS'}</div>
            )}
            <span className="text-[18px] font-semibold tracking-tight text-app-text">{currentBrand ? currentBrand.name : 'LiveSync'}</span>
          </div>
        </div>

        {/* User pill */}
        <div className="px-5 py-5">
          {currentUser ? (
            <div className="flex items-center gap-3 p-3 btn-surface border border-white/50">
              <img src={currentUser.avatar} className="w-9 h-9 rounded-full object-cover flex-shrink-0 shadow-sm" alt="" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#262626] truncate">{currentUser.name}</p>
                <p className="text-[11px] font-light text-[#A3A3A3]">{currentUser.role === 'SUPER_ADMIN' ? 'System Admin' : currentUser.role === 'MANAGER' ? 'Quản lý' : 'Nhân sự'}</p>
              </div>
            </div>
          ) : (
            <div className="w-full px-3 py-2">
              <p className="text-[13px] font-medium text-[#262626]">Chưa đăng nhập</p>
              <p className="text-[11px] font-light text-[#A3A3A3] mt-1">Dùng nút “Đăng nhập / Hướng dẫn” ở đầu trang.</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <SidebarItem icon={<Calendar size={18}/>} label="Lịch" active={viewMode === 'DASHBOARD'} onClick={() => setViewMode('DASHBOARD')} />
          {currentUser && currentUser.role === 'STAFF' && (
            <SidebarItem icon={<CheckCircle2 size={18}/>} label="Đăng ký" active={viewMode === 'MY_AVAILABILITY'} onClick={() => setViewMode('MY_AVAILABILITY')} />
          )}
          {currentUser && currentUser.role === 'STAFF' && (
            <SidebarItem icon={<TrendingUp size={18}/>} label="Lương của tôi" active={viewMode === 'MY_SALARY'} onClick={() => setViewMode('MY_SALARY')} />
          )}
          {currentUser && (
            <SidebarItem icon={<Inbox size={18}/>} label="Yêu cầu" active={viewMode === 'REQUESTS'} onClick={() => setViewMode('REQUESTS')} badge={(currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'OPERATIONS') && pendingCount > 0 ? pendingCount : undefined}/>
          )}
          {currentUser && (
            <SidebarItem icon={<Bell size={18}/>} label="Thông báo" active={isNotifPanelOpen} onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)} badge={unreadCount > 0 ? unreadCount : undefined} />
          )}
          {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'OPERATIONS') && (
            <>
              <div className="px-3 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hệ thống</div>
              <SidebarItem icon={<Users size={18}/>} label="Nhân sự" active={viewMode === 'STAFF_MANAGEMENT'} onClick={() => setViewMode('STAFF_MANAGEMENT')} />
              {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                <SidebarItem icon={<CalendarCheck size={18}/>} label="Chấm công" active={viewMode === 'TIMEKEEPING'} onClick={() => { setViewMode('TIMEKEEPING'); }} />
              )}
              <SidebarItem icon={<BarChart3 size={18}/>} label="Báo cáo" active={viewMode === 'REPORTS'} onClick={() => setViewMode('REPORTS')} />
              <SidebarItem icon={<Settings size={18}/>} label="Cấu hình" active={viewMode === 'SETTINGS'} onClick={() => setViewMode('SETTINGS')} />
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="p-5 mt-auto border-t border-black/5">
          {currentUser ? (
            <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 font-medium text-[13px] px-2 py-2 w-full rounded-xl hover:bg-red-50 transition-colors">
              <LogOut size={15} strokeWidth={1.5}/> {currentUser.role === 'SUPER_ADMIN' ? 'Về Panel Quản Trị' : 'Đăng xuất'}
            </button>
          ) : (
            <div className="w-full px-2">
              <p className="text-[13px] font-medium text-[#262626]">Vui lòng đăng nhập</p>
              <p className="text-[11px] font-light text-[#A3A3A3] mt-1">Bạn có thể xem hướng dẫn ở đầu trang.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full relative">
        {/* Desktop auth bar: đặt nút Đăng nhập/Hướng dẫn ở ngoài vùng lịch */}
        {!currentUser && (
          <div className="hidden md:flex sticky top-0 z-40 mb-6 items-center justify-between gap-3 px-2 py-3 rounded-2xl bg-gradient-to-b from-white/75 to-transparent backdrop-blur-[2px] border border-black/5">
            <div className="min-w-0">
              <div className="text-[20px] font-semibold tracking-tight text-[#1A1A1A] truncate">
                {currentBrand ? currentBrand.name : 'LiveSync'}
              </div>
              <div className="text-[11px] font-light text-[#A3A3A3] mt-0.5">Chưa đăng nhập</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setIsLoginPageOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 btn-surface border border-white/80 shadow-soft text-[#262626]"
              >
                <LogIn size={14} strokeWidth={1.5} /> <span className="text-[12px] font-medium">Đăng nhập</span>
              </button>
              <button
                onClick={() => (window.location.href = '/huong-dan.html')}
                className="flex items-center gap-1.5 px-3 py-2 btn-surface border border-white/80 shadow-soft text-[#262626]"
              >
                <Info size={14} strokeWidth={1.5} /> <span className="text-[12px] font-medium">Hướng dẫn</span>
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center" style={{background:'rgba(250,250,250,0.75)',backdropFilter:'blur(8px)'}}>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin" style={{color:'#2563EB'}}/>
              <span className="text-[13px] font-medium" style={{color:'#737373'}}>Đang đồng bộ...</span>
            </div>
          </div>
        )}

        {/* Floating Date Toolbar */}
        {(viewMode === 'DASHBOARD' || viewMode === 'MY_AVAILABILITY' || viewMode === 'REPORTS') && (
          <div className="mb-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sticky top-0 z-30 py-2">
            <div className="toolbar-pill">
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors" style={{color:'#737373'}}><ChevronLeft size={14}/></button>
              <span className="text-[13px] font-semibold tabular-nums px-1" style={{color:'#171717',minWidth:'120px',textAlign:'center'}}>Tháng {currentDate.getMonth() + 1} / {currentDate.getFullYear()}</span>
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors" style={{color:'#737373'}}><ChevronRight size={14}/></button>
              <div style={{width:'1px',height:'16px',background:'#E5E5E5',margin:'0 4px'}} />
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(w => (
                  <button
                    key={w}
                    onClick={() => setCurrentWeek(w)}
                    className="px-2.5 py-1 rounded-full text-[12px] font-medium transition-all"
                    style={currentWeek === w ? {background:'#171717',color:'#fff'} : {color:'#737373'}}
                  >
                    T{w}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'DASHBOARD' && (currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={14}/>} onClick={handleExportExcel}>Xuất Excel</Button>
                <Button variant="primary" size="sm" onClick={handleAutoSchedule} icon={<Sparkles size={14}/>}>Xếp ca AI</Button>
              </div>
            )}
            {/* Login is now handled by the persistent header/sidebar for better UX */}
          </div>
        )}

        {/* Platform Tab Switcher */}
        {(viewMode === 'DASHBOARD' || viewMode === 'MY_AVAILABILITY' || viewMode === 'REQUESTS') && (
          <div className="mb-4 flex items-center gap-1 p-1 rounded-xl w-fit" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}}>
            {(['tiktok', 'shopee'] as Platform[]).map(p => {
              const cfg = PLATFORM_CONFIG[p];
              const isActive = activePlatform === p;
              const count = p === 'tiktok'
                ? schedule.filter(s => s.platform === 'tiktok').length
                : schedule.filter(s => s.platform === 'shopee').length;
              return (
                <button
                  key={p}
                  onClick={() => setActivePlatform(p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                  style={{
                    background: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? cfg.color : '#A3A3A3',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    border: isActive ? '1px solid #E5E5E5' : '1px solid transparent',
                  }}
                >
                  <PlatformIcon platform={p} size={16} />
                  {cfg.label}
                  {count > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? cfg.bgLight : '#EBEBEB',
                        color: isActive ? cfg.color : '#A3A3A3',
                      }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-[22px] font-medium tracking-tight mb-0.5" style={{color:'#171717'}}>
              {viewMode === 'DASHBOARD' && 'Lịch làm việc'}
              {viewMode === 'MY_AVAILABILITY' && 'Đăng ký lịch rảnh'}
              {viewMode === 'REQUESTS' && 'Yêu cầu'}
              {viewMode === 'STAFF_MANAGEMENT' && 'Nhân sự'}
              {viewMode === 'SETTINGS' && 'Cấu hình'}
              {viewMode === 'REPORTS' && 'Báo cáo'}
              {viewMode === 'TIMEKEEPING' && 'Chấm công'}
              {viewMode === 'MY_SALARY' && 'Lương của tôi'}
            </h1>
            <p className="text-[13px]" style={{color:'#737373'}}>
              {(viewMode === 'DASHBOARD' || viewMode === 'MY_AVAILABILITY')
                ? `Tuần ${currentWeek} — Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`
                : 'Quản trị hệ thống livestream'}
            </p>
          </div>
          <div className="flex gap-2">
            {viewMode === 'STAFF_MANAGEMENT' && (
              <Button variant="mono" size="sm" onClick={() => handleOpenUserModal()} icon={<UserPlus size={14}/>}>Thêm nhân sự</Button>
            )}
            {viewMode === 'SETTINGS' && (
              <Button variant="mono" size="sm" onClick={() => handleOpenShiftModal()} icon={<Plus size={14}/>}>Thêm Ca Live</Button>
            )}
          </div>
        </div>


        {/* ── Personal Schedule Summary (Staff/Ops only, Dashboard view) ── */}
        {viewMode === 'DASHBOARD' && currentUser && currentUser.role !== 'MANAGER' && (() => {
          // Compute this user's shifts for the current week
          const mySlots = currentWeekSchedule.filter(s =>
            s.streamerAssignments.some(sa => sa.userId === currentUser.id) || s.opsUserId === currentUser.id
          );
          const totalShifts = mySlots.length;
          // Total hours: sum each shift's duration roughly
          const estimatedHours = mySlots.reduce((acc, slot) => {
            const sh = shifts.find(s => s.id === slot.shiftId);
            if (!sh) return acc;
            const [sh1, sm1] = sh.startTime.split(':').map(Number);
            const [sh2, sm2] = sh.endTime.split(':').map(Number);
            let mins = (sh2 * 60 + sm2) - (sh1 * 60 + sm1);
            if (mins < 0) mins += 24 * 60; // overnight shifts
            return acc + mins / 60;
          }, 0);

          return (
            <div className="mb-5 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-4"
              style={{background:'#FFFFFF', borderColor:'#F0F0F0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              {/* Left: stats */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl"
                  style={{background: totalShifts > 0 ? '#EFF6FF' : '#F5F5F5'}}>
                  <span className="text-[22px] font-semibold tabular-nums leading-none"
                    style={{color: totalShifts > 0 ? '#2563EB' : '#D4D4D4'}}>{totalShifts}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
                    style={{color: totalShifts > 0 ? '#93C5FD' : '#D4D4D4'}}>ca</span>
                </div>
                <div>
                  <p className="text-[13px] font-medium leading-tight" style={{color:'#171717'}}>
                    Lịch của {currentUser.name.split(' ').pop()}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{color:'#A3A3A3'}}>
                    {totalShifts > 0
                      ? `${estimatedHours % 1 === 0 ? estimatedHours : estimatedHours.toFixed(1)} giờ · Tuần ${currentWeek}`
                      : `Chưa có ca nào — Tuần ${currentWeek}`}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px self-stretch" style={{background:'#F0F0F0'}}/>
              <div className="block sm:hidden h-px w-full" style={{background:'#F0F0F0'}}/>

              {/* Right: shift chips */}
              {totalShifts === 0 ? (
                <div className="flex-1 flex items-center gap-2" style={{color:'#D4D4D4'}}>
                  <CalendarCheck size={14}/>
                  <span className="text-[12px] font-medium">Tuần này bạn chưa được xếp ca. Hãy đăng ký lịch rảnh!</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-wrap gap-2">
                  {mySlots
                    .slice()
                    .sort((a, b) => a.dayIndex - b.dayIndex)
                    .map((slot, i) => {
                      const sh = shifts.find(s => s.id === slot.shiftId);
                      const date = weekDates[slot.dayIndex];
                      const sa = slot.streamerAssignments.find(x => x.userId === currentUser.id);
                      const isOps = slot.opsUserId === currentUser.id;
                      const todaySlot = isToday(date);
                      return (
                        <div key={i}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
                          style={{
                            background: todaySlot ? '#EFF6FF' : '#FAFAFA',
                            borderColor: todaySlot ? '#BFDBFE' : '#F0F0F0',
                          }}
                        >
                          {/* Day */}
                          <div className="flex flex-col items-center" style={{minWidth: 28}}>
                            <span className="text-[8px] font-semibold uppercase tracking-wider" style={{color:'#A3A3A3'}}>
                              {DAYS_OF_WEEK[slot.dayIndex]?.replace('Thứ ', 'T')}
                            </span>
                            <span className="text-[14px] font-semibold tabular-nums leading-none"
                              style={{color: todaySlot ? '#2563EB' : '#171717'}}>
                              {date?.getDate()}
                            </span>
                          </div>
                          {/* Divider */}
                          <div className="w-px self-stretch" style={{background:'#E5E5E5'}}/>
                          {/* Shift */}
                          <div>
                            <p className="text-[11px] font-medium leading-tight" style={{color:'#171717'}}>{sh?.name}</p>
                            <p className="text-[9px] font-mono" style={{color:'#A3A3A3'}}>{sh?.startTime}–{sh?.endTime}</p>
                            {sa?.timeLabel && (
                              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                                style={{background:'#EFF6FF', color:'#2563EB'}}>{sa.timeLabel}</span>
                            )}
                            {isOps && (
                              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                                style={{background:'#FFF7ED', color:'#C2410C'}}>Kỹ thuật</span>
                            )}
                          </div>
                          {todaySlot && (
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'#2563EB'}}/>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })()}

        {/* DASHBOARD VIEW — Responsive Schedule Grid */}
        {viewMode === 'DASHBOARD' && (
          <>
            {/* Manager progress bar — compact pill instead of large widget */}
            {currentUser?.role === 'MANAGER' && (
              <div className="mb-4 flex items-center justify-between gap-3 p-3 bg-white rounded-xl border" style={{borderColor:'#E5E5E5'}}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#F5F5F5'}}>
                    <ListTodo size={14} style={{color:'#737373'}}/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{color:'#171717'}}>Đăng ký tuần {currentWeek}</p>
                    <p className="text-[11px]" style={{color:'#A3A3A3'}}>{submittedCount}/{staffUsers.length} nhân sự đã nộp</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {staffUsers.map(u => (
                    <div key={u.id} className="relative flex-shrink-0" title={u.name}>
                      <img src={u.avatar} className={`w-6 h-6 rounded-full object-cover transition-all ${u.isAvailabilitySubmitted ? 'opacity-100' : 'opacity-30 grayscale'}`} alt={u.name}/>
                      {u.isAvailabilitySubmitted && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center" style={{background:'#22C55E',border:'1.5px solid #fff'}}>
                          <Check size={5} strokeWidth={4} color="#fff"/>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── MOBILE: Day Selector + Single-day cards ── */}
            <div className="block md:hidden">
              {/* Day picker strip */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const date = weekDates[idx];
                  const today = isToday(date);
                  const selected = selectedDayIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl transition-all"
                      style={{
                        width: 48, minHeight: 64,
                        background: selected ? '#171717' : today ? '#F0F6FF' : '#FAFAFA',
                        border: `1.5px solid ${selected ? '#171717' : today ? '#BFDBFE' : '#E5E5E5'}`,
                        color: selected ? '#FFFFFF' : today ? '#2563EB' : '#737373',
                      }}
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wider mb-1">{day.replace('Thứ ', 'T')}</span>
                      <span className="text-[17px] font-medium tabular-nums leading-none">{date.getDate()}</span>
                      {today && !selected && <div className="w-1 h-1 rounded-full mt-1" style={{background:'#2563EB'}}/>}
                    </button>
                  );
                })}
              </div>

              {/* Selected day label */}
              <p className="text-[12px] font-semibold mb-3" style={{color:'#A3A3A3'}}>
                {DAYS_OF_WEEK[selectedDayIndex]} {weekDates[selectedDayIndex]?.getDate()}/{weekDates[selectedDayIndex] ? weekDates[selectedDayIndex].getMonth()+1 : ''}
              </p>

              {/* Shift cards for selected day */}
              <div className="space-y-2">
                {platformShifts.map(shift => {
                  const slot = currentWeekSchedule.find(s => s.dayIndex === selectedDayIndex && s.shiftId === shift.id);
                  const ops = users.find(u => u.id === slot?.opsUserId);
                  const isMyShift = slot?.streamerAssignments.some(sa => sa.userId === currentUser?.id) || slot?.opsUserId === currentUser?.id;
                  return (
                    <div
                      key={shift.id}
                      onClick={() => {
                        checkAuth(() => {
                          if (currentUser?.role === 'MANAGER' || currentUser?.role === 'OPERATIONS') {
                            setEditingSlot({ day: selectedDayIndex, shiftId: shift.id });
                            setIsSlotModalOpen(true);
                          } else if (isMyShift) {
                            setRequestForm({ type: 'LEAVE', reason: '', slot: { day: selectedDayIndex, shiftId: shift.id } });
                            setIsRequestModalOpen(true);
                          }
                        });
                      }}
                      className="flex items-stretch gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: isMyShift ? '#F0F6FF' : '#FFFFFF',
                        borderColor: isMyShift ? '#BFDBFE' : '#F0F0F0',
                        boxShadow: isMyShift ? '0 0 0 2px rgba(37,99,235,0.08)' : 'none'
                      }}
                    >
                      {/* Left: shift info */}
                      <div className="flex flex-col justify-center" style={{minWidth: 80}}>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium w-fit mb-1 ${shift.color}`}>{shift.startTime}–{shift.endTime}</span>
                        <p className="text-[13px] font-semibold" style={{color:'#171717'}}>{shift.name}</p>
                      </div>
                      {/* Right: people */}
                      <div className="flex-1 flex flex-col justify-center gap-1.5">
                        {!slot ? (
                          <div className="flex items-center gap-1.5" style={{color:'#D4D4D4'}}>
                            <Plus size={12}/>
                            <span className="text-[11px] font-medium">Chưa xếp ca</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {slot.streamerAssignments.map((sa, i) => {
                                const u = users.find(u => u.id === sa.userId);
                                const hasOT = (sa.overtimeMinutes || 0) > 0;
                                const hasBridge = !!sa.timeLabel;
                                return (
                                  <div key={i} className="flex items-center gap-1 flex-wrap">
                                    <img src={u?.avatar} className="w-5 h-5 rounded-full object-cover" alt=""/>
                                    <span className="text-[11px] font-medium" style={{color:'#171717'}}>{u?.name}</span>
                                    {hasBridge && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded" style={{background:'#EFF6FF',color:'#2563EB',border:'1px solid #BFDBFE'}}>
                                        <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 1h3v3H2zM7 1h3v3H7zM2 6h3v3H2zM7 6h3v3H7z" fill="currentColor"/></svg>
                                        {sa.timeLabel}
                                      </span>
                                    )}
                                    {hasOT && (
                                      <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{background:'#FEF3C7',color:'#D97706',border:'1px solid #FDE68A'}}>OT</span>
                                    )}
                                  </div>
                                );
                              })}

                            </div>
                            {ops && (
                              <div className="flex items-center gap-1" style={{color:'#A3A3A3'}}>
                                <Wrench size={10}/>
                                <span className="text-[10px]">{ops.name}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {isMyShift && <div className="self-start mt-0.5" style={{color:'#2563EB'}}><Edit2 size={11}/></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── DESKTOP: Compact 7-column grid ── */}
            <div className="hidden md:block">
              <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{minWidth: 700}}>
                    <thead>
                      <tr style={{background:'#FAFAFA',borderBottom:'1px solid #F0F0F0'}}>
                        <th className="sticky left-0 z-20 text-left border-r" style={{background:'#FAFAFA',borderColor:'#F0F0F0',width:100,padding:'10px 14px'}}>
                          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Ca Live</span>
                        </th>
                        {DAYS_OF_WEEK.map((day, idx) => {
                          const date = weekDates[idx];
                          const today = isToday(date);
                          return (
                            <th key={idx} className="text-center" style={{padding:'8px 6px', minWidth: 110, background: today ? '#F0F6FF' : 'transparent'}}>
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] font-semibold uppercase tracking-widest" style={{color: today ? '#2563EB' : '#A3A3A3', marginBottom:2}}>{day}</span>
                                <span className={`text-[15px] font-medium tabular-nums leading-none ${today ? 'w-7 h-7 rounded-full flex items-center justify-center text-white' : ''}`}
                                  style={today ? {background:'#2563EB'} : {color:'#171717'}}>
                                  {date.getDate()}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {platformShifts.map((shift, sIdx) => (
                        <tr key={shift.id} style={{borderTop: sIdx > 0 ? '1px solid #F5F5F5' : 'none'}}>
                          {/* Shift label — sticky */}
                          <td className="sticky left-0 z-10 border-r align-middle" style={{background:'#FFFFFF',borderColor:'#F0F0F0',padding:'10px 14px',minHeight:80}}>
                            <p className="text-[12px] font-semibold leading-tight" style={{color:'#171717'}}>{shift.name}</p>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium mt-1 ${shift.color}`}>{shift.startTime}–{shift.endTime}</span>
                          </td>
                          {DAYS_OF_WEEK.map((_, dayIdx) => {
                            const slot = currentWeekSchedule.find(s => s.dayIndex === dayIdx && s.shiftId === shift.id);
                            const ops = users.find(u => u.id === slot?.opsUserId);
                            const isMyShift = slot?.streamerAssignments.some(sa => sa.userId === currentUser?.id) || slot?.opsUserId === currentUser?.id;
                            const today = isToday(weekDates[dayIdx]);
                            const slotHasOT = slot?.streamerAssignments.some(sa => (sa.overtimeMinutes || 0) > 0) ?? false;
                            const slotHasBridge = slot?.streamerAssignments.some(sa => !!sa.timeLabel) ?? false;
                            return (
                              <td key={dayIdx}
                                onClick={() => {
                                  checkAuth(() => {
                                    if (currentUser?.role === 'MANAGER' || currentUser?.role === 'OPERATIONS') {
                                      setEditingSlot({ day: dayIdx, shiftId: shift.id });
                                      setIsSlotModalOpen(true);
                                    } else if (isMyShift) {
                                      setRequestForm({ type: 'LEAVE', reason: '', slot: { day: dayIdx, shiftId: shift.id } });
                                      setIsRequestModalOpen(true);
                                    }
                                  });
                                }}
                                className="align-top cursor-pointer group transition-colors"
                                style={{padding: 6, verticalAlign:'top', background: today ? '#F8FBFF' : 'transparent'}}
                              >
                                <div
                                  className="rounded-lg transition-all h-full relative"
                                  style={{
                                    minHeight: 76,
                                    padding: 8,
                                    background: slot ? (isMyShift ? '#F0F6FF' : '#FAFAFA') : 'transparent',
                                    border: slot ? `1px solid ${isMyShift ? '#BFDBFE' : '#F0F0F0'}` : '1.5px dashed #EBEBEB',
                                    boxShadow: isMyShift ? '0 0 0 2px rgba(37,99,235,0.08)' : 'none',
                                  }}
                                >
                                  {/* Slot-level indicators (top-right corner) */}
                                  {(slotHasOT || slotHasBridge) && (
                                    <div className="absolute top-1 right-1 flex items-center gap-0.5">
                                      {slotHasBridge && (
                                        <span title="Có kẹp ca" className="w-4 h-4 rounded-full flex items-center justify-center" style={{background:'#EFF6FF',border:'1px solid #BFDBFE'}}>
                                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 1h3v3H2zM7 1h3v3H7zM2 6h3v3H2zM7 6h3v3H7z" fill="#2563EB"/></svg>
                                        </span>
                                      )}
                                      {slotHasOT && (
                                        <span title="Có giờ thêm" className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-extrabold leading-none" style={{background:'#FEF3C7',border:'1px solid #FDE68A',color:'#D97706'}}>OT</span>
                                      )}
                                    </div>
                                  )}

                                  {!slot ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{color:'#D4D4D4',minHeight:60}}>
                                      <Plus size={12} strokeWidth={2}/>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
                                      {slot.streamerAssignments.map((sa, i) => {
                                        const u = users.find(user => user.id === sa.userId);
                                        const hasOT = (sa.overtimeMinutes || 0) > 0;
                                        const hasBridge = !!sa.timeLabel;
                                        return (
                                          <div key={i} className="flex items-start gap-1.5">
                                            <img src={u?.avatar} className="w-5 h-5 rounded-full object-cover flex-shrink-0 mt-0.5" alt=""/>
                                            <div className="min-w-0">
                                              <p className="text-[10px] font-semibold truncate leading-tight" style={{color:'#171717'}}>{u?.name}</p>
                                              {(hasBridge || hasOT) && (
                                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                  {hasBridge && (
                                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1 py-0.5 rounded" style={{background:'#EFF6FF',color:'#2563EB',border:'1px solid #BFDBFE'}}>
                                                      <svg width="6" height="6" viewBox="0 0 12 12" fill="none"><path d="M2 1h3v3H2zM7 1h3v3H7zM2 6h3v3H2zM7 6h3v3H7z" fill="currentColor"/></svg>
                                                      {sa.timeLabel}
                                                    </span>
                                                  )}
                                                  {hasOT && (
                                                    <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{background:'#FEF3C7',color:'#D97706',border:'1px solid #FDE68A'}}>OT</span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {ops && (
                                        <div className="flex items-center gap-1 pt-1" style={{borderTop:'1px solid #F0F0F0',marginTop:2}}>
                                          <Wrench size={8} style={{color:'#A3A3A3',flexShrink:0}}/>
                                          <span className="text-[9px] truncate" style={{color:'#A3A3A3'}}>{ops.name}</span>
                                        </div>
                                      )}
                                      {!slot.streamerAssignments.length && !ops && (
                                        <span className="text-[9px]" style={{color:'#D4D4D4'}}>Trống</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {viewMode === 'MY_AVAILABILITY' && currentUser && (
          <div className="space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-medium flex items-center gap-2 text-[15px]" style={{color:'#171717'}}>
                  <CalendarCheck className="w-4 h-4" style={{color:'#2563EB'}}/> Đăng ký lịch rảnh
                </h3>
                <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>Chọn các ca bạn có thể làm việc trong tuần này.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Legend */}
                <div className="flex items-center gap-3 text-[11px] font-semibold px-3 py-2 rounded-lg" style={{background:'#F5F5F5',border:'1px solid #E5E5E5',color:'#737373'}}>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{background:'#2563EB'}}></div>Rảnh</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{background:'#E5E5E5'}}></div>Bận</div>
                </div>
                {/* Submit button */}
                {currentUser.isAvailabilitySubmitted ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium" style={{background:'#F0FDF4',border:'1px solid #BBF7D0',color:'#16A34A'}}>
                    <Check size={13} strokeWidth={3}/> Đã gửi
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitAvailability}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:opacity-90 active:scale-95"
                    style={{background:'#2563EB',color:'#fff'}}
                  >
                    <Send size={13}/> Gửi đăng ký
                  </button>
                )}
              </div>
            </div>

            {/* ── MOBILE: Day picker + shift toggle cards ── */}
            <div className="block md:hidden">
              {/* Day picker strip */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const date = weekDates[idx];
                  const today = isToday(date);
                  const selected = selectedDayIndex === idx;
                  const dayAvCount = shifts.filter(sh =>
                    currentWeekAvailabilities.some(a => a.userId === currentUser.id && a.dayIndex === idx && a.shiftId === sh.id)
                  ).length;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl transition-all relative"
                      style={{
                        width: 52, minHeight: 70,
                        background: selected ? '#171717' : today ? '#F0F6FF' : '#FAFAFA',
                        border: `1.5px solid ${selected ? '#171717' : today ? '#BFDBFE' : '#E5E5E5'}`,
                        color: selected ? '#FFFFFF' : today ? '#2563EB' : '#737373',
                      }}
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wider mb-1">{day.replace('Thứ ', 'T')}</span>
                      <span className="text-[18px] font-medium tabular-nums leading-none">{date.getDate()}</span>
                      {dayAvCount > 0 && (
                        <div className="mt-1 flex gap-0.5">
                          {Array.from({length: Math.min(dayAvCount, 4)}).map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full" style={{background: selected ? '#93C5FD' : '#2563EB'}}/>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected day label */}
              <p className="text-[12px] font-semibold my-3" style={{color:'#A3A3A3'}}>
                {DAYS_OF_WEEK[selectedDayIndex]} · {weekDates[selectedDayIndex]?.getDate()}/{weekDates[selectedDayIndex] ? weekDates[selectedDayIndex].getMonth()+1 : ''}
              </p>

              {/* Shift toggle cards */}
              <div className="space-y-2">
                {platformShifts.map(shift => {
                  const isAvailable = currentWeekAvailabilities.some(
                    a => a.userId === currentUser.id && a.dayIndex === selectedDayIndex && a.shiftId === shift.id
                  );
                  return (
                    <button
                      key={shift.id}
                      onClick={() => !currentUser.isAvailabilitySubmitted && toggleAvailability(selectedDayIndex, shift.id)}
                      disabled={currentUser.isAvailabilitySubmitted}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left"
                      style={{
                        background: isAvailable ? '#EFF6FF' : '#FAFAFA',
                        borderColor: isAvailable ? '#2563EB' : '#E5E5E5',
                        opacity: currentUser.isAvailabilitySubmitted ? 0.7 : 1,
                      }}
                    >
                      {/* Toggle indicator */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                        style={{background: isAvailable ? '#2563EB' : '#E5E5E5'}}
                      >
                        {isAvailable
                          ? <Check size={18} strokeWidth={2.5} color="#fff"/>
                          : <span className="text-[11px] font-semibold" style={{color:'#A3A3A3'}}>—</span>
                        }
                      </div>
                      {/* Shift info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium leading-tight" style={{color: isAvailable ? '#1D4ED8' : '#171717'}}>{shift.name}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{color: isAvailable ? '#3B82F6' : '#A3A3A3'}}>{shift.startTime} – {shift.endTime}</p>
                      </div>
                      {/* Status label */}
                      <span className="text-[11px] font-semibold flex-shrink-0" style={{color: isAvailable ? '#2563EB' : '#D4D4D4'}}>
                        {isAvailable ? 'Rảnh' : 'Bận'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile submit if not submitted */}
              {!currentUser.isAvailabilitySubmitted && (
                <button
                  onClick={handleSubmitAvailability}
                  className="w-full mt-4 py-3.5 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{background:'#2563EB',color:'#fff'}}
                >
                  <Send size={15}/> Gửi đăng ký tuần này
                </button>
              )}
            </div>

            {/* ── DESKTOP: Compact 7-column grid ── */}
            <div className="hidden md:block bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0" style={{minWidth: 620}}>
                  <thead>
                    <tr style={{background:'#FAFAFA',borderBottom:'1px solid #F0F0F0'}}>
                      <th className="sticky left-0 z-20 text-left border-r" style={{background:'#FAFAFA',borderColor:'#F0F0F0',width:110,padding:'10px 14px'}}>
                        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Ca Live</span>
                      </th>
                      {DAYS_OF_WEEK.map((day, idx) => {
                        const date = weekDates[idx];
                        const today = isToday(date);
                        return (
                          <th key={idx} className="text-center" style={{padding:'8px 4px', minWidth:92, background: today ? '#F0F6FF' : 'transparent'}}>
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-semibold uppercase tracking-widest" style={{color: today ? '#2563EB' : '#A3A3A3', marginBottom:2}}>{day}</span>
                              <span className={`text-[14px] font-medium tabular-nums leading-none${today ? ' w-6 h-6 rounded-full flex items-center justify-center text-white' : ''}`}
                                style={today ? {background:'#2563EB'} : {color:'#171717'}}>
                                {date.getDate()}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {platformShifts.map((shift, sIdx) => (
                      <tr key={shift.id} style={{borderTop: sIdx > 0 ? '1px solid #F5F5F5' : 'none'}}>
                        <td className="sticky left-0 z-10 border-r" style={{background:'#FFFFFF',borderColor:'#F0F0F0',padding:'10px 14px'}}>
                          <p className="text-[12px] font-semibold leading-tight" style={{color:'#171717'}}>{shift.name}</p>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium mt-1 ${shift.color}`}>{shift.startTime}–{shift.endTime}</span>
                        </td>
                        {DAYS_OF_WEEK.map((_, dayIdx) => {
                          const isAvailable = currentWeekAvailabilities.some(
                            a => a.userId === currentUser.id && a.dayIndex === dayIdx && a.shiftId === shift.id
                          );
                          const today = isToday(weekDates[dayIdx]);
                          return (
                            <td key={dayIdx} style={{padding: 5, background: today ? '#F8FBFF' : 'transparent'}}>
                              <button
                                onClick={() => !currentUser.isAvailabilitySubmitted && toggleAvailability(dayIdx, shift.id)}
                                disabled={currentUser.isAvailabilitySubmitted}
                                className="w-full rounded-lg transition-all duration-150 flex items-center justify-center"
                                style={{
                                  height: 52,
                                  background: isAvailable ? '#2563EB' : '#F5F5F5',
                                  border: `1.5px solid ${isAvailable ? '#2563EB' : '#EBEBEB'}`,
                                  cursor: currentUser.isAvailabilitySubmitted ? 'not-allowed' : 'pointer',
                                  opacity: currentUser.isAvailabilitySubmitted ? 0.7 : 1,
                                }}
                              >
                                {isAvailable
                                  ? <Check size={16} strokeWidth={2.5} color="#fff"/>
                                  : <span style={{fontSize:'16px',color:'#D4D4D4',lineHeight:1}}>·</span>
                                }
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Requests Management Section */}
        {viewMode === 'REQUESTS' && currentUser && (() => {
          // Role-based filter: Manager sees all, staff sees only their own
          const visibleRequests = canManageRequests
            ? requests
            : requests.filter(r => r.userId === currentUser.id);

          const pendingVisible = visibleRequests.filter(r => r.status === 'PENDING').length;

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-medium flex items-center gap-2" style={{color:'#171717'}}>
                    <MessageSquare size={15} style={{color:'#737373'}}/>
                    {canManageRequests ? 'Tất cả yêu cầu' : 'Yêu cầu của tôi'}
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>
                    {canManageRequests
                      ? `${visibleRequests.length} yêu cầu${pendingVisible > 0 ? ` · ${pendingVisible} chờ duyệt` : ''}`
                      : `${visibleRequests.length} yêu cầu đã gửi`}
                  </p>
                </div>
                </div>

              {visibleRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed text-center"
                  style={{borderColor:'#E5E5E5', background:'#FAFAFA'}}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{background:'#F5F5F5'}}>
                    <MessageSquare size={20} style={{color:'#D4D4D4'}}/>
                  </div>
                  <p className="text-[14px] font-semibold" style={{color:'#171717'}}>
                    {canManageRequests ? 'Chưa có yêu cầu nào' : 'Bạn chưa gửi yêu cầu nào'}
                  </p>
                  <p className="text-[12px] mt-1" style={{color:'#A3A3A3'}}>
                    {canManageRequests
                      ? 'Các yêu cầu xin nghỉ hoặc đổi ca sẽ xuất hiện tại đây.'
                      : 'Chọn ca của bạn trong lịch làm việc để gửi yêu cầu xin nghỉ hoặc đổi ca.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleRequests.map(req => {
                    const shift = shifts.find(s => s.id === req.shiftId);
                    const isPending = req.status === 'PENDING';
                    const isMyRequest = req.userId === currentUser.id;
                    return (
                      <div key={req.id}
                        className="p-4 rounded-xl border flex flex-col gap-3 relative overflow-hidden transition-all"
                        style={{
                          background: isPending ? '#FFFFFF' : '#FAFAFA',
                          borderColor: isPending ? '#E5E5E5' : '#F0F0F0',
                          opacity: !isPending ? 0.8 : 1,
                          boxShadow: isPending ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
                        }}>
                        {/* Pending indicator stripe */}
                        {isPending && (
                          <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
                            style={{background:'#F59E0B'}}/>
                        )}

                        {/* Top row: user + status */}
                        <div className="flex items-start justify-between gap-2 pl-2">
                          <div className="flex items-center gap-2.5">
                            <img src={users.find(u => u.id === req.userId)?.avatar}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2"
                              style={{borderColor:'#F0F0F0'}} alt=""/>
                            <div>
                              <p className="text-[13px] font-medium leading-tight" style={{color:'#171717'}}>
                                {isMyRequest && currentUser.role !== 'MANAGER' ? 'Tôi' : req.userName}
                              </p>
                              <p className="text-[10px]" style={{color:'#A3A3A3'}}>
                                {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase ${
                            req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-100' :
                            req.status === 'REJECTED' ? 'bg-red-50 text-red-600 border border-red-100' :
                            'bg-orange-50 text-orange-600 border border-orange-100'
                          }`}>
                            {req.status === 'APPROVED' ? '✓ Đã duyệt' : req.status === 'REJECTED' ? '✕ Từ chối' : '⏳ Chờ duyệt'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="pl-2 space-y-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              req.type === 'LEAVE'
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            }`}>
                              {req.type === 'LEAVE' ? 'Xin nghỉ' : 'Đổi ca'}
                            </span>
                            <PlatformBadge platform={req.platform} size="sm" />
                            <span className="text-[11px]" style={{color:'#A3A3A3'}}>·</span>
                            <span className="text-[11px] font-medium" style={{color:'#737373'}}>{DAYS_OF_WEEK[req.dayIndex]}</span>
                            <span className="text-[11px]" style={{color:'#A3A3A3'}}>·</span>
                            <span className="text-[11px] font-medium" style={{color:'#171717'}}>{shift?.name}</span>
                          </div>
                          {req.type === 'SWAP' && req.targetUserName && (
                            <div className="text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1.5"
                              style={{background:'#F5F5F5', color:'#737373'}}>
                              <ArrowRightLeft size={11}/>
                              <span>Đổi với: <span className="font-medium" style={{color:'#171717'}}>{req.targetUserName}</span></span>
                            </div>
                          )}
                          {req.reason && (
                            <p className="text-[11px] px-2 py-1.5 rounded-lg italic"
                              style={{background:'#F5F5F5', color:'#737373'}}>
                              "{req.reason}"
                            </p>
                          )}
                        </div>

                        {/* Manager approve/reject actions */}
                         {canManageRequests && isPending && (
                          <div className="flex gap-2 pt-1 pl-2">
                            <button
                              onClick={() => handleProcessRequest(req.id, 'REJECTED')}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:bg-slate-100"
                              style={{border:'1px solid #E5E5E5', color:'#737373'}}
                            >Từ chối</button>
                            <button
                              onClick={() => handleProcessRequest(req.id, 'APPROVED')}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:opacity-90"
                              style={{background:'#171717', color:'#fff'}}
                            >Chấp thuận</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {viewMode === 'STAFF_MANAGEMENT' && currentUser && (() => {
          const searchQ = staffSearchQuery;
          const setSearchQ = setStaffSearchQuery;
          const roleFilter = staffRoleFilter;
          const setRoleF = setStaffRoleFilter;
          const filtered = users.filter(u => {
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
            if (searchQ && !u.name.toLowerCase().includes(searchQ.toLowerCase()) && !u.id.toLowerCase().includes(searchQ.toLowerCase())) return false;
            return true;
          });
          const staffCount = users.filter(u=>u.role==='STAFF').length;
          const opsCount = users.filter(u=>u.role==='OPERATIONS').length;
          const mgrCount = users.filter(u=>u.role==='MANAGER'||u.role==='SUPER_ADMIN').length;

          return (
            <div className="space-y-4">
              {/* KPI strip */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  {label:'Tổng',value:`${users.length}`,color:'#171717'},
                  {label:'Mẫu live',value:`${staffCount}`,color:'#4F46E5'},
                  {label:'Kỹ thuật',value:`${opsCount}`,color:'#D97706'},
                  {label:'Quản lý',value:`${mgrCount}`,color:'#059669'},
                ].map((s,i)=>(
                  <div key={i} className="py-2 px-2 rounded-xl text-center" style={{background:'#fff',border:'1px solid #F0F0F0'}}>
                    <p className="text-[16px] font-bold tabular-nums" style={{color:s.color}}>{s.value}</p>
                    <p className="text-[8px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text" placeholder="Tìm tên hoặc username..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] outline-none"
                    style={{background:'#fff',border:'1px solid #E5E5E5',color:'#171717'}}
                    value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[
                    {key:'ALL',label:'Tất cả'},
                    {key:'STAFF',label:'Mẫu live',color:'#4F46E5'},
                    {key:'OPERATIONS',label:'Kỹ thuật',color:'#D97706'},
                    {key:'MANAGER',label:'Quản lý',color:'#059669'},
                  ].map(f=>(
                    <button key={f.key} onClick={()=>setRoleF(f.key)}
                      className="px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
                      style={roleFilter===f.key
                        ? {background:f.color||'#171717',color:'#fff'}
                        : {background:'#F5F5F5',color:'#737373'}
                      }>{f.label}</button>
                  ))}
                </div>
              </div>

              {/* Card grid */}
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border py-14 text-center" style={{borderColor:'#E5E5E5'}}>
                  <Users size={28} className="mx-auto mb-3" style={{color:'#D4D4D4'}}/>
                  <p className="text-[13px]" style={{color:'#A3A3A3'}}>Không tìm thấy nhân sự</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map(u => (
                    <div key={u.id} className="bg-white rounded-2xl border p-4 transition-all hover:shadow-md" style={{borderColor:'#E5E5E5'}}>
                      {/* Top: Avatar + Info + Actions */}
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <img src={u.avatar} className="w-11 h-11 rounded-2xl object-cover" style={{
                            border: u.isAvailabilitySubmitted ? '2px solid #22C55E' : '2px solid #F0F0F0',
                          }} alt=""/>
                          {u.isAvailabilitySubmitted && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{background:'#22C55E',border:'2px solid #fff'}}>
                              <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold truncate" style={{color:'#171717'}}>{u.name}</p>
                          <p className="text-[11px] font-mono truncate" style={{color:'#A3A3A3'}}>@{u.id}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <RoleBadge role={u.role} />
                            {u.role === 'STAFF' && <RankBadge rank={u.rank} size="sm" />}
                          </div>
                        </div>
                        {/* Actions — always visible */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleOpenUserModal(u)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-slate-100" style={{color:'#737373'}} title="Sửa">
                            <Edit2 size={14}/>
                          </button>
                          {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                            <button onClick={() => handleDeleteUser(u.id)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-red-50" style={{color:'#D4D4D4'}} title="Xóa">
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Bottom: Metadata */}
                      <div className="flex items-center justify-between mt-3 pt-3" style={{borderTop:'1px solid #F5F5F5'}}>
                        <div className="flex items-center gap-1.5">
                          {(u.platforms || ['tiktok']).map(p => <PlatformBadge key={p} platform={p} size="sm" />)}
                        </div>
                        {u.role === 'STAFF' && (u.hourlyRate||0)>0 ? (
                          <span className="text-[11px] font-bold tabular-nums" style={{color:'#059669'}}>{u.hourlyRate!.toLocaleString()}đ/h</span>
                        ) : u.role === 'STAFF' ? (
                          <span className="text-[10px]" style={{color:'#D4D4D4'}}>Chưa cài lương</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add button (floating on mobile) */}
              {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                <button
                  onClick={() => handleOpenUserModal()}
                  className="fixed sm:static bottom-20 right-4 sm:bottom-auto sm:right-auto w-12 h-12 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full sm:rounded-xl flex items-center justify-center gap-2 z-40 sm:z-auto"
                  style={{background:'#4F46E5',color:'#fff',boxShadow:'0 4px 20px rgba(79,70,229,0.35)'}}
                >
                  <UserPlus size={18}/>
                  <span className="hidden sm:inline text-[13px] font-semibold">Thêm nhân sự</span>
                </button>
              )}
            </div>
          );
        })()}




        {viewMode === 'SETTINGS' && (currentUser?.role === 'MANAGER' || currentUser?.role === 'OPERATIONS') && (
          <div className="space-y-6">
            {/* Shifts Management Section */}
            <div className="bg-white rounded-2xl border p-6" style={{borderColor:'#E5E5E5'}}>
               <div className="flex items-center justify-between mb-5">
                 <div>
                    <h3 className="text-[15px] font-medium flex items-center gap-2" style={{color:'#171717',letterSpacing:'-0.02em'}}><Clock size={16} style={{color:'#737373'}}/> Ca Live</h3>
                    <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>Quản lý các khung giờ livestream.</p>
                 </div>
               </div>

               {/* Platform filter tabs for shifts */}
               <div className="flex items-center gap-1 p-1 rounded-xl w-fit mb-4" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}}>
                 {(['tiktok', 'shopee'] as Platform[]).map(p => {
                   const cfg = PLATFORM_CONFIG[p];
                   const isActive = activePlatform === p;
                   const count = shifts.filter(s => s.platform === p).length;
                   return (
                     <button
                       key={p}
                       onClick={() => setActivePlatform(p)}
                       className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                       style={{
                         background: isActive ? '#FFFFFF' : 'transparent',
                         color: isActive ? cfg.color : '#A3A3A3',
                         boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                         border: isActive ? '1px solid #E5E5E5' : '1px solid transparent',
                       }}
                     >
                       <PlatformIcon platform={p} size={14} />
                       {cfg.label}
                       <span className="text-[10px] font-medium px-1 py-0.5 rounded-full"
                         style={{background: isActive ? cfg.bgLight : '#EBEBEB', color: isActive ? cfg.color : '#A3A3A3'}}>{count}</span>
                     </button>
                   );
                 })}
               </div>
               
               <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-500">
                        <tr>
                           <th className="p-4">Tên Ca</th>
                           <th className="p-4">Thời gian</th>
                           <th className="p-4">Màu sắc</th>
                           <th className="p-4 text-right">Hành động</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {shifts.filter(s => s.platform === activePlatform).map(shift => (
                           <tr key={shift.id} className="hover:bg-slate-50/50">
                              <td className="p-4 font-medium">{shift.name}</td>
                              <td className="p-4 font-mono">{shift.startTime} - {shift.endTime}</td>
                              <td className="p-4">
                                 <div className={`px-2 py-1 rounded text-xs font-medium w-fit ${shift.color}`}>Mẫu hiển thị</div>
                              </td>
                              <td className="p-4 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleOpenShiftModal(shift)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDeleteShift(shift.id)} className="p-2 text-slate-400 hover:text-red-600 bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        )}

        {/* ───────────── REPORTS VIEW ───────────── */}
        {viewMode === 'REPORTS' && currentUser && (() => {
          const [rMonth, setRMonth] = [timekeepingMonth, setTimekeepingMonth];
          const [rYear, setRYear] = [timekeepingYear, setTimekeepingYear];
          const months2R = Array.from({length:12},(_,i)=>i+1);
          const years2R = [new Date().getFullYear()-1, new Date().getFullYear()];

          const parseH = (t: string) => { const m = t?.trim().match(/^(\d{1,2})(?:[:h](\d{1,2}))?/); return m ? parseInt(m[1]) + (m[2] ? parseInt(m[2]) : 0) / 60 : 0; };
          const calcH = (shift: Shift, sa: { timeLabel?: string; overtimeMinutes?: number }) => {
            let base = 0;
            if (sa.timeLabel) { const p = sa.timeLabel.split(/\s*-\s*/); if (p.length===2){const s=parseH(p[0]);const e=parseH(p[1]);base=e-s;if(base<0)base+=24;} }
            else { const s=parseH(shift.startTime);const e=parseH(shift.endTime);base=e-s;if(base<0)base+=24;if(base===0)base=4; }
            return base + (sa.overtimeMinutes||0)/60;
          };
          const getSlotDate = (item: ScheduleItem): Date | null => {
            const wm = item.weekId?.match(/^(\d{4})-(\d{2})-W(\d{1,2})$/); if (!wm) return null;
            const yr=parseInt(wm[1]),mo=parseInt(wm[2])-1,wk=parseInt(wm[3]);
            const d1=new Date(yr,mo,1);const dow=d1.getDay()===0?6:d1.getDay()-1;
            const mon1=new Date(yr,mo,1-dow+(wk-1)*7);
            return new Date(mon1.getTime()+item.dayIndex*86400000);
          };
          const monthSchedule = schedule.filter(s => { const d = getSlotDate(s); return d && d.getMonth()===rMonth-1 && d.getFullYear()===rYear; });
          const staffUsers = users.filter(u => u.role === 'STAFF');
          const totalShifts = monthSchedule.length;
          const totalAssigns = monthSchedule.reduce((s,i)=>s+i.streamerAssignments.length,0);
          let grandH = 0; let grandCost = 0;
          monthSchedule.forEach(item => {
            const sh = shifts.find(s=>s.id===item.shiftId); if (!sh) return;
            item.streamerAssignments.forEach(sa => { const u = users.find(x=>x.id===sa.userId); const h = calcH(sh,sa); grandH+=h; grandCost+=h*(u?.hourlyRate||0); });
          });

          // Staff leaderboard
          const staffBoard = staffUsers.map(u => {
            let hrs=0;let cnt=0;let otMin=0;
            monthSchedule.forEach(item => {
              const sh = shifts.find(s=>s.id===item.shiftId); if (!sh) return;
              const sa = item.streamerAssignments.find(a=>a.userId===u.id); if (!sa) return;
              hrs+=calcH(sh,sa); cnt++; otMin+=sa.overtimeMinutes||0;
            });
            return {u,hrs,cnt,otMin,cost:hrs*(u.hourlyRate||0)};
          }).filter(r=>r.cnt>0).sort((a,b)=>b.hrs-a.hrs);

          // Daily breakdown
          const byDate: Record<string,{date:Date;shifts:number;hrs:number;cost:number;users:User[]}> = {};
          monthSchedule.forEach(item => {
            const d = getSlotDate(item); if (!d) return;
            const key = d.toISOString().slice(0,10);
            if (!byDate[key]) byDate[key]={date:d,shifts:0,hrs:0,cost:0,users:[]};
            byDate[key].shifts++;
            const sh = shifts.find(s=>s.id===item.shiftId); if (!sh) return;
            item.streamerAssignments.forEach(sa => {
              const u = users.find(x=>x.id===sa.userId); const h = calcH(sh,sa);
              byDate[key].hrs+=h; byDate[key].cost+=h*(u?.hourlyRate||0);
              if (u && !byDate[key].users.find(x=>x.id===u.id)) byDate[key].users.push(u);
            });
          });
          const dailyRows = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);
          const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
          const fmt = (n:number)=>n.toLocaleString('vi-VN');
          const fmtH = (h:number)=>h%1===0?`${h}h`:`${h.toFixed(1)}h`;
          const maxCost = Math.max(...dailyRows.map(r=>r.cost),1);

          return (
            <div className="space-y-5">
              {/* Header + month selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight flex items-center gap-2" style={{color:'#171717'}}>
                    <BarChart3 size={18} style={{color:'#4F46E5'}}/> Báo cáo tổng hợp
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>Thống kê hoạt động live tháng {rMonth}/{rYear}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select className="px-3 py-2 rounded-xl text-[13px] font-medium outline-none" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}} value={rMonth} onChange={e=>setRMonth(Number(e.target.value))}>
                    {months2R.map(m=><option key={m} value={m}>Tháng {m}</option>)}
                  </select>
                  <select className="px-3 py-2 rounded-xl text-[13px] font-medium outline-none" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}} value={rYear} onChange={e=>setRYear(Number(e.target.value))}>
                    {years2R.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* KPI cards */}
              <div className={`grid gap-3 ${currentUser.role === 'OPERATIONS' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                {[
                  {label:'Tổng ca',value:`${totalShifts}`,sub:'ca đã lên lịch',color:'#4F46E5'},
                  {label:'Lượt live',value:`${totalAssigns}`,sub:`${staffBoard.length} nhân viên`,color:'#0891B2'},
                  {label:'Tổng giờ',value:fmtH(grandH),sub:'toàn bộ streamer',color:'#059669'},
                  ...(currentUser.role !== 'OPERATIONS' ? [{label:'Chi phí',value:grandCost>0?`${fmt(Math.round(grandCost/1000))}k`:'—',sub:'lương tháng này',color:'#D97706'}] : []),
                ].map((s,i)=>(
                  <div key={i} className="p-3 rounded-2xl text-center" style={{background:'#fff',border:'1px solid #F0F0F0',boxShadow:'0 1px 4px rgba(0,0,0,0.03)'}}>
                    <p className="text-[20px] font-bold tabular-nums leading-tight" style={{color:s.color}}>{s.value}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5" style={{color:'#A3A3A3'}}>{s.label}</p>
                    <p className="text-[9px]" style={{color:'#D4D4D4'}}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Bar chart — daily costs */}
              {dailyRows.length>0 && currentUser.role !== 'OPERATIONS' && (
                <div className="bg-white rounded-2xl border p-4" style={{borderColor:'#E5E5E5'}}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{color:'#A3A3A3'}}>Chi phí theo ngày</p>
                  <div className="flex items-end gap-[2px]" style={{height:'100px'}}>
                    {dailyRows.map((r,i)=>{
                      const pct = maxCost>0?Math.max((r.cost/maxCost)*100,2):2;
                      const isT = new Date().toDateString()===r.date.toDateString();
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${r.date.getDate()}/${r.date.getMonth()+1}: ${fmt(Math.round(r.cost))}đ`}>
                          <div className="w-full rounded-t transition-all" style={{height:`${pct}%`,background:isT?'#4F46E5':'#C7D2FE',minHeight:'2px'}}/>
                          {dailyRows.length<=16 && <span className="text-[7px] tabular-nums" style={{color:isT?'#4F46E5':'#A3A3A3'}}>{r.date.getDate()}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px]" style={{color:'#D4D4D4'}}>{dailyRows[0]?.date.getDate()}/{rMonth}</span>
                    <span className="text-[9px]" style={{color:'#D4D4D4'}}>{dailyRows[dailyRows.length-1]?.date.getDate()}/{rMonth}</span>
                  </div>
                </div>
              )}

              {/* Staff leaderboard */}
              {staffBoard.length>0 && (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:'1px solid #F0F0F0'}}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Bảng xếp hạng nhân viên</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{background:'#F5F5F5',color:'#737373'}}>{staffBoard.length}</span>
                  </div>
                  {staffBoard.map((r,i)=>(
                    <div key={r.u.id} className="flex items-center gap-2.5 px-4 py-2.5" style={{borderTop:i>0?'1px solid #F5F5F5':'none'}}>
                      <span className="text-[11px] font-bold w-5 text-center tabular-nums" style={{color:i<3?'#4F46E5':'#D4D4D4'}}>#{i+1}</span>
                      <img src={r.u.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0" style={{border:'1.5px solid #F0F0F0'}} alt=""/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{color:'#171717'}}>{r.u.name}</p>
                        <p className="text-[10px]" style={{color:'#A3A3A3'}}>{r.cnt} ca · {fmtH(r.hrs)}{r.otMin>0?` · +${r.otMin}ph OT`:''}</p>
                      </div>
                      {/* Progress bar */}
                      <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{background:'#F0F0F0'}}>
                        <div className="h-full rounded-full" style={{width:`${staffBoard[0]?.hrs>0?Math.round((r.hrs/staffBoard[0].hrs)*100):0}%`,background:'#4F46E5'}}/>
                      </div>
                      {currentUser.role !== 'OPERATIONS' && <span className="text-[11px] font-bold tabular-nums flex-shrink-0 min-w-[60px] text-right" style={{color:r.cost>0?'#059669':'#D4D4D4'}}>{r.cost>0?`${fmt(Math.round(r.cost))}đ`:'—'}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Daily accordion */}
              {dailyRows.length>0 ? (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
                  <div className="px-4 py-3" style={{borderBottom:'1px solid #F0F0F0'}}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Chi tiết hàng ngày</p>
                  </div>
                  {dailyRows.map((day,di)=>{
                    const isT=new Date().toDateString()===day.date.toDateString();
                    return (
                      <div key={di} className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5" style={{borderTop:di>0?'1px solid #F0F0F0':'none',borderLeft:isT?'3px solid #4F46E5':'3px solid transparent'}}>
                        <div className="flex-shrink-0 w-10 text-center">
                          <p className="text-[14px] font-bold tabular-nums leading-tight" style={{color:isT?'#4F46E5':'#171717'}}>{day.date.getDate()}</p>
                          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{color:isT?'#6366F1':'#A3A3A3'}}>{dayNames[day.date.getDay()]}</p>
                        </div>
                        <div className="w-px h-7 flex-shrink-0" style={{background:'#E5E5E5'}}/>
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold" style={{color:'#525252'}}>{day.shifts} ca</span>
                          <span className="text-[10px] tabular-nums" style={{color:'#A3A3A3'}}>{fmtH(day.hrs)}</span>
                          <div className="flex -space-x-1.5 ml-1">
                            {day.users.slice(0,3).map((u,ui)=><img key={ui} src={u.avatar} className="w-5 h-5 rounded-full object-cover ring-2 ring-white" alt="" title={u.name}/>)}
                            {day.users.length>3&&<span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ring-2 ring-white" style={{background:'#E5E5E5',color:'#737373'}}>+{day.users.length-3}</span>}
                          </div>
                        </div>
                        {currentUser.role !== 'OPERATIONS' && <span className="text-[12px] font-bold tabular-nums flex-shrink-0" style={{color:day.cost>0?'#059669':'#D4D4D4'}}>{day.cost>0?`${fmt(Math.round(day.cost))}đ`:'—'}</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border py-14 text-center" style={{borderColor:'#E5E5E5'}}>
                  <BarChart3 size={28} className="mx-auto mb-3" style={{color:'#D4D4D4'}}/>
                  <p className="text-[13px]" style={{color:'#A3A3A3'}}>Chưa có dữ liệu tháng {rMonth}/{rYear}</p>
                </div>
              )}
            </div>
          );
        })()}







        {/* ─────── TIMEKEEPING VIEW (Manager/Admin) ─────── */}
        {viewMode === 'TIMEKEEPING' && (currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (() => {
          const p = (t: string) => { const m = t?.trim().match(/^(\d{1,2})(?:[:h](\d{1,2}))?/); return m ? parseInt(m[1]) + (m[2] ? parseInt(m[2]) : 0) / 60 : 0; };
          const ch = (shift: Shift, sa: { timeLabel?: string; overtimeMinutes?: number }) => {
            let base = 0;
            if (sa.timeLabel) { const pts = sa.timeLabel.split(/\s*-\s*/); if (pts.length===2){const s=p(pts[0]);const e=p(pts[1]);base=e-s;if(base<0)base+=24;} }
            else { const s=p(shift.startTime);const e=p(shift.endTime);base=e-s;if(base<0)base+=24;if(base===0)base=4; }
            return base + (sa.overtimeMinutes||0)/60;
          };
          const gd = (item: ScheduleItem): Date|null => {
            const wm = item.weekId?.match(/^(\d{4})-(\d{2})-W(\d{1,2})$/); if (!wm) return null;
            const yr=parseInt(wm[1]),mo=parseInt(wm[2])-1,wk=parseInt(wm[3]);
            const d1=new Date(yr,mo,1);const dow=d1.getDay()===0?6:d1.getDay()-1;
            const mon1=new Date(yr,mo,1-dow+(wk-1)*7);
            return new Date(mon1.getTime()+item.dayIndex*86400000);
          };

          // Check if a shift is completed: shift date + endTime must be in the past
          const isShiftDone = (item: ScheduleItem, shift: Shift): boolean => {
            const d = gd(item); if (!d) return false;
            const endH = p(shift.endTime);
            const startH = p(shift.startTime);
            // Handle overnight shifts (endTime < startTime means next day)
            const endDate = new Date(d);
            if (endH <= startH) {
              // Overnight: shift ends next day
              endDate.setDate(endDate.getDate() + 1);
            }
            endDate.setHours(Math.floor(endH), Math.round((endH % 1) * 60), 0, 0);
            return endDate.getTime() <= Date.now();
          };

          // STAFF only (no OPERATIONS)
          const staffList = users.filter(u => u.role === 'STAFF');
          // Only count shifts that are completed (past shift end time)
          const tkSched = schedule.filter(s => {
            const d=gd(s);
            if (!d || d.getMonth()!==timekeepingMonth-1 || d.getFullYear()!==timekeepingYear) return false;
            const sh = shifts.find(x=>x.id===s.shiftId);
            if (!sh) return false;
            return isShiftDone(s, sh);
          });

          const saveBonus = async (userId: string) => {
            if (!activeBrandSlug) return;
            setTimekeepingSaving(userId);
            try {
              await api.upsertTimekeeping({ userId, brandId: activeBrandSlug, month: timekeepingMonth, year: timekeepingYear, bonusAmount: timekeepingDraft[userId]?.bonusAmount||0, note: timekeepingDraft[userId]?.note||'' });
              // Reload from DB after save to sync state
              const recs = await api.getTimekeeping(activeBrandSlug, timekeepingMonth, timekeepingYear);
              setTimekeepingRecords(recs);
              const draft: Record<string,{bonusAmount:number;note:string}> = {};
              recs.forEach(r => { draft[r.userId]={bonusAmount:r.bonusAmount,note:r.note||''}; });
              setTimekeepingDraft(draft);
            } catch(e) { console.error('saveBonus failed', e); }
            finally { setTimekeepingSaving(null); }
          };
          const loadBonus = async () => {
            if (!activeBrandSlug) return;
            setTimekeepingLoading(true);
            const recs = await api.getTimekeeping(activeBrandSlug, timekeepingMonth, timekeepingYear);
            setTimekeepingRecords(recs);
            const draft: Record<string,{bonusAmount:number;note:string}> = {};
            recs.forEach(r => { draft[r.userId]={bonusAmount:r.bonusAmount,note:r.note||''}; });
            setTimekeepingDraft(draft); setTimekeepingLoading(false);
          };

          const fmt = (n:number)=>n.toLocaleString('vi-VN');
          const fmtH = (h:number)=>h%1===0?`${h}h`:`${h.toFixed(1)}h`;
          const months2 = Array.from({length:12},(_,i)=>i+1);
          const years2 = [new Date().getFullYear()-1, new Date().getFullYear()];
          const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];

          // Per-staff summary (real-time)
          const staffStats = staffList.map(u => {
            let hrs=0; let otMin=0; let cnt=0;
            const dayRows: Array<{date:Date;shiftName:string;hrs:number;otMin:number;salary:number}> = [];
            tkSched.forEach(item => {
              const sh = shifts.find(s=>s.id===item.shiftId); if (!sh) return;
              const sa = item.streamerAssignments.find(a=>a.userId===u.id); if (!sa) return;
              const h = ch(sh,sa); hrs+=h; otMin+=sa.overtimeMinutes||0; cnt++;
              const d = gd(item);
              if (d) dayRows.push({date:d,shiftName:sh.name,hrs:h,otMin:sa.overtimeMinutes||0,salary:h*(u.hourlyRate||0)});
            });
            dayRows.sort((a,b)=>a.date.getTime()-b.date.getTime());
            const base = hrs*(u.hourlyRate||0);
            const bonus = timekeepingRecords.find(r=>r.userId===u.id&&r.month===timekeepingMonth&&r.year===timekeepingYear);
            const bonusAmt = timekeepingDraft[u.id]?.bonusAmount ?? bonus?.bonusAmount ?? 0;
            const bonusNote = timekeepingDraft[u.id]?.note ?? bonus?.note ?? '';
            return {u, hrs, otMin, cnt, base, bonusAmt, bonusNote, total:base+bonusAmt, dayRows};
          });

          const tkTab = timekeepingTab;
          const setTkTab = setTimekeepingTab;
          const grandBase = staffStats.reduce((s,r)=>s+r.base,0);
          const grandBonus = staffStats.reduce((s,r)=>s+r.bonusAmt,0);
          const grandTotal = grandBase+grandBonus;

          // Daily breakdown: group all staff shifts by date
          const byDateTK: Record<string,{date:Date;items:Array<{user:User;shiftName:string;hrs:number;otMin:number;salary:number}>}> = {};
          staffList.forEach(u => {
            tkSched.forEach(item => {
              const sh = shifts.find(s=>s.id===item.shiftId); if (!sh) return;
              const sa = item.streamerAssignments.find(a=>a.userId===u.id); if (!sa) return;
              const d = gd(item); if (!d) return;
              const key = d.toISOString().slice(0,10);
              if (!byDateTK[key]) byDateTK[key]={date:d,items:[]};
              byDateTK[key].items.push({user:u,shiftName:sh.name,hrs:ch(sh,sa),otMin:sa.overtimeMinutes||0,salary:ch(sh,sa)*(u.hourlyRate||0)});
            });
          });
          const dailyTKRows = Object.entries(byDateTK).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);

          return (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-semibold flex items-center gap-2" style={{color:'#171717'}}>
                    <CalendarCheck size={18} style={{color:'#4F46E5'}}/> Chấm công
                    {timekeepingLoading
                      ? <Loader2 size={13} className="animate-spin ml-1" style={{color:'#4F46E5'}}/>
                      : <span className="text-[11px] font-normal px-2 py-0.5 rounded-full ml-1" style={{background:'#F0FDF4',color:'#059669',border:'1px solid #BBF7D0'}}>● Real-time</span>
                    }
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>Tháng {timekeepingMonth}/{timekeepingYear} · Dữ liệu cập nhật liên tục theo lịch live</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select className="px-3 py-2 rounded-xl text-[13px] font-medium outline-none" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}} value={timekeepingMonth} onChange={e=>setTimekeepingMonth(Number(e.target.value))}>
                    {months2.map(m=><option key={m} value={m}>Tháng {m}</option>)}
                  </select>
                  <select className="px-3 py-2 rounded-xl text-[13px] font-medium outline-none" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}} value={timekeepingYear} onChange={e=>setTimekeepingYear(Number(e.target.value))}>
                    {years2.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'Nhân sự',value:`${staffList.length}`,sub:'người',color:'#4F46E5'},
                  {label:'Tổng giờ',value:fmtH(staffStats.reduce((s,r)=>s+r.hrs,0)),sub:`${staffStats.reduce((s,r)=>s+r.cnt,0)} ca`,color:'#0891B2'},
                  {label:'Lương cơ bản',value:grandBase>0?`${fmt(Math.round(grandBase/1000))}k`:'—',sub:'tổng tháng',color:'#059669'},
                ].map((s,i)=>(
                  <div key={i} className="p-3 rounded-2xl text-center" style={{background:'#fff',border:'1px solid #F0F0F0',boxShadow:'0 1px 4px rgba(0,0,0,0.03)'}}>
                    <p className="text-[18px] font-bold tabular-nums" style={{color:s.color}}>{s.value}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>{s.label}</p>
                    <p className="text-[9px]" style={{color:'#D4D4D4'}}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 p-1 rounded-xl" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}}>
                {[{key:'summary',label:'Tổng hợp nhân sự'},{key:'daily',label:'Theo từng ngày'}].map(t=>(
                  <button key={t.key} onClick={()=>setTkTab(t.key as 'summary'|'daily')}
                    className="flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all"
                    style={tkTab===t.key?{background:'#fff',color:'#171717',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}:{color:'#A3A3A3'}}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tkTab==='summary' && (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
                  {staffList.length===0
                    ? <div className="py-14 text-center" style={{color:'#D4D4D4'}}><CalendarCheck size={28} className="mx-auto mb-3"/><p className="text-[13px]" style={{color:'#A3A3A3'}}>Ch\u01b0a c\u00f3 nh\u00e2n s\u1ef1 m\u1eabu live</p></div>
                    : <div className="divide-y" style={{borderColor:'#F5F5F5'}}>
                        {staffStats.map(stat=>{
                          return (
                            <div key={stat.u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={()=>setTimekeepingDetailUserId(stat.u.id)}>
                              <img src={stat.u.avatar} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{border:'1.5px solid #F0F0F0'}} alt=""/>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold truncate" style={{color:'#171717'}}>{stat.u.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[11px]" style={{color:'#A3A3A3'}}>{stat.cnt} ca · {fmtH(stat.hrs)}</span>
                                  {stat.otMin>0&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{background:'#FEF3C7',color:'#D97706'}}>OT</span>}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 mr-2">
                                <p className="text-[13px] font-bold tabular-nums" style={{color:stat.base>0?'#059669':'#D4D4D4'}}>{stat.base>0?`${fmt(Math.round(stat.base))}đ`:'—'}</p>
                                <p className="text-[10px]" style={{color:'#A3A3A3'}}>{(stat.u.hourlyRate||0)>0?`${fmt(stat.u.hourlyRate!)}đ/h`:'Chưa thiết lập'}</p>
                              </div>
                              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{background:'#EEF2FF',color:'#4F46E5'}}>
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>
              )}



              {/* DAILY TAB — Compact Accordion */}
              {tkTab==='daily' && (
                dailyTKRows.length===0 ? (
                  <div className="bg-white rounded-2xl border py-14 text-center" style={{borderColor:'#E5E5E5',color:'#D4D4D4'}}>
                    <CalendarCheck size={28} className="mx-auto mb-3"/>
                    <p className="text-[13px]" style={{color:'#A3A3A3'}}>Chưa có ca live nào trong tháng {timekeepingMonth}/{timekeepingYear}</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
                    {dailyTKRows.map((day,di)=>{
                      const dayKey=day.date.toISOString().slice(0,10);
                      const isToday2=new Date().toDateString()===day.date.toDateString();
                      const isOpen=expandedTKDay===dayKey;
                      const dayTotal=day.items.reduce((s,r)=>s+r.salary,0);
                      const dayHrs=day.items.reduce((s,r)=>s+r.hrs,0);
                      const hasOT=day.items.some(i=>i.otMin>0);
                      const uniqueUsers = day.items.reduce((acc,i)=>{if(!acc.find(u=>u.id===i.user.id))acc.push(i.user);return acc;},[] as typeof day.items[0]['user'][]);
                      return (
                        <div key={di}>
                          {/* Collapsed row */}
                          <div
                            className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5 cursor-pointer transition-colors hover:bg-slate-50 select-none"
                            style={{borderTop:di>0?'1px solid #F0F0F0':'none',borderLeft:isToday2?'3px solid #4F46E5':'3px solid transparent',background:isOpen?'#FAFAFA':'transparent'}}
                            onClick={()=>setExpandedTKDay(isOpen?null:dayKey)}
                          >
                            {/* Date badge */}
                            <div className="flex-shrink-0 w-10 text-center">
                              <p className="text-[15px] font-bold tabular-nums leading-tight" style={{color:isToday2?'#4F46E5':'#171717'}}>{day.date.getDate()}</p>
                              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{color:isToday2?'#6366F1':'#A3A3A3'}}>{dayNames[day.date.getDay()]}</p>
                            </div>
                            {/* Separator */}
                            <div className="w-px h-7 flex-shrink-0" style={{background:'#E5E5E5'}}/>
                            {/* Stats */}
                            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold whitespace-nowrap" style={{color:'#525252'}}>{day.items.length} ca</span>
                              <span className="text-[10px] tabular-nums" style={{color:'#A3A3A3'}}>{fmtH(dayHrs)}</span>
                              {hasOT&&<span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{background:'#FEF3C7',color:'#D97706'}}>OT</span>}
                              {/* Avatar stack */}
                              <div className="flex items-center -space-x-1.5 ml-1">
                                {uniqueUsers.slice(0,4).map((u,ui)=>(
                                  <img key={ui} src={u.avatar} className="w-5 h-5 rounded-full object-cover ring-2 ring-white" alt="" title={u.name}/>
                                ))}
                                {uniqueUsers.length>4&&<span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ring-2 ring-white" style={{background:'#E5E5E5',color:'#737373'}}>+{uniqueUsers.length-4}</span>}
                              </div>
                            </div>
                            {/* Total */}
                            <span className="text-[12px] font-bold tabular-nums flex-shrink-0" style={{color:dayTotal>0?'#059669':'#D4D4D4'}}>{dayTotal>0?`${fmt(Math.round(dayTotal))}đ`:'—'}</span>
                            {/* Chevron */}
                            <svg className="flex-shrink-0 transition-transform duration-200" style={{transform:isOpen?'rotate(90deg)':'rotate(0deg)',color:'#A3A3A3'}} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          {/* Expanded detail rows */}
                          {isOpen && (
                            <div style={{background:'#FAFAFA',borderTop:'1px solid #F0F0F0'}}>
                              {day.items.map((item,ii)=>(
                                <div key={ii} className="flex items-center gap-2.5 px-4 sm:px-5 py-2" style={{borderTop:ii>0?'1px solid #F5F5F5':'none',paddingLeft:'calc(12px + 40px + 10px + 1px + 10px)'}}>
                                  <img src={item.user.avatar} className="w-6 h-6 rounded-full object-cover flex-shrink-0" style={{border:'1.5px solid #E5E5E5'}} alt=""/>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold truncate" style={{color:'#171717'}}>{item.user.name}</p>
                                    <p className="text-[10px]" style={{color:'#A3A3A3'}}>{item.shiftName}</p>
                                  </div>
                                  <span className="text-[11px] font-medium tabular-nums flex-shrink-0" style={{color:'#525252'}}>{fmtH(item.hrs)}</span>
                                  {item.otMin>0&&<span className="text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{background:'#FEF3C7',color:'#D97706'}}>+{item.otMin}ph</span>}
                                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0 min-w-[60px] text-right" style={{color:item.salary>0?'#059669':'#D4D4D4'}}>{item.salary>0?`${fmt(Math.round(item.salary))}đ`:'—'}</span>
                                </div>
                              ))}
                              {/* Day summary row */}
                              <div className="flex items-center gap-2.5 px-4 sm:px-5 py-2" style={{borderTop:'1.5px solid #E5E5E5',paddingLeft:'calc(12px + 40px + 10px + 1px + 10px)'}}>
                                <div className="flex-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{color:'#737373'}}>Tổng ngày</span>
                                </div>
                                <span className="text-[11px] font-bold tabular-nums" style={{color:'#525252'}}>{fmtH(dayHrs)}</span>
                                <span className="text-[11px] font-bold tabular-nums min-w-[60px] text-right" style={{color:'#059669'}}>{fmt(Math.round(dayTotal))}đ</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              <div className="flex items-start gap-2 p-3 rounded-xl" style={{background:'#EFF6FF',border:'1px solid #BFDBFE'}}>
                <Info size={14} style={{color:'#2563EB',marginTop:1,flexShrink:0}}/>
                <p className="text-[11px] leading-relaxed" style={{color:'#1D4ED8'}}>Dữ liệu giờ live cập nhật <strong>real-time</strong> theo lịch. Bấm vào tên nhân viên để xem bảng công chi tiết và nhập tiền hỗ trợ. Nhân sự sẽ thấy tiền hỗ trợ trong trang <strong>"Lương của tôi"</strong>.</p>
              </div>

              {/* DETAIL MODAL */}
              {timekeepingDetailUserId && (() => {
                const stat = staffStats.find(s=>s.u.id===timekeepingDetailUserId);
                if (!stat) return null;
                return (
                  <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" onClick={()=>setTimekeepingDetailUserId(null)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
                    <div className="relative w-full sm:max-w-lg sm:mx-4 bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden" style={{maxHeight:'92vh',boxShadow:'0 24px 80px rgba(0,0,0,0.18)'}} onClick={e=>e.stopPropagation()}>
                      {/* Drag handle mobile */}
                      <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 rounded-full bg-slate-200"/></div>
                      {/* Header */}
                      <div className="px-5 py-4 flex items-center gap-3" style={{borderBottom:'1px solid #F0F0F0'}}>
                        <img src={stat.u.avatar} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" style={{border:'2px solid #F0F0F0',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}} alt=""/>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-bold truncate" style={{color:'#171717'}}>{stat.u.name}</p>
                          <p className="text-[11px]" style={{color:'#A3A3A3'}}>Bảng công · Tháng {timekeepingMonth}/{timekeepingYear}</p>
                        </div>
                        <button onClick={()=>setTimekeepingDetailUserId(null)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'#F5F5F5',color:'#737373'}}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                      {/* KPI strip */}
                      <div className="grid grid-cols-3 divide-x" style={{borderBottom:'1px solid #F0F0F0',background:'#FAFAFA'}}>
                        {[
                          {label:'Tổng ca',value:`${stat.cnt}`,sub:'ca làm việc',color:'#4F46E5'},
                          {label:'Tổng giờ',value:fmtH(stat.hrs),sub:stat.otMin>0?`+${stat.otMin}ph OT`:'Không OT',color:'#0891B2'},
                          {label:'Lương cơ bản',value:stat.base>0?`${fmt(Math.round(stat.base/1000))}k`:'—',sub:(stat.u.hourlyRate||0)>0?`${fmt(stat.u.hourlyRate!)}đ/h`:'Chưa cài',color:'#059669'},
                        ].map((k,ki)=>(
                          <div key={ki} className="py-3 px-3 text-center" style={{borderColor:'#F0F0F0'}}>
                            <p className="text-[18px] font-bold tabular-nums leading-tight" style={{color:k.color}}>{k.value}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5" style={{color:'#A3A3A3'}}>{k.label}</p>
                            <p className="text-[9px] mt-0.5" style={{color:'#D4D4D4'}}>{k.sub}</p>
                          </div>
                        ))}
                      </div>
                      {/* Shift history */}
                      <div className="overflow-y-auto" style={{maxHeight:'calc(92vh - 200px)'}}>
                        {stat.dayRows.length===0
                          ? <div className="py-12 text-center"><CalendarCheck size={24} className="mx-auto mb-2" style={{color:'#D4D4D4'}}/><p className="text-[12px]" style={{color:'#A3A3A3'}}>Chưa có ca nào trong tháng này</p></div>
                          : <div>
                              {/* Table header */}
                              <div className="flex items-center gap-2 px-4 py-2" style={{background:'#FAFAFA',borderBottom:'1px solid #F0F0F0'}}>
                                <span className="text-[9px] font-semibold uppercase tracking-widest w-14 flex-shrink-0" style={{color:'#A3A3A3'}}>Ngày</span>
                                <span className="text-[9px] font-semibold uppercase tracking-widest flex-1" style={{color:'#A3A3A3'}}>Ca</span>
                                <span className="text-[9px] font-semibold uppercase tracking-widest w-10 text-right flex-shrink-0" style={{color:'#A3A3A3'}}>Giờ</span>
                                <span className="text-[9px] font-semibold uppercase tracking-widest w-[70px] text-right flex-shrink-0" style={{color:'#A3A3A3'}}>Lương</span>
                              </div>
                              {/* Rows */}
                              {stat.dayRows.map((row,ri)=>{
                                const isT=new Date().toDateString()===row.date.toDateString();
                                return (
                                  <div key={ri} className="flex items-center gap-2 px-4 py-2.5" style={{borderTop:ri>0?'1px solid #F5F5F5':'none',background:isT?'#F0F7FF':'transparent',borderLeft:isT?'3px solid #4F46E5':'3px solid transparent'}}>
                                    <div className="w-14 flex-shrink-0">
                                      <p className="text-[12px] font-bold tabular-nums" style={{color:isT?'#4F46E5':'#171717'}}>{row.date.getDate()}/{row.date.getMonth()+1}</p>
                                      <p className="text-[9px]" style={{color:'#A3A3A3'}}>{dayNames[row.date.getDay()]}</p>
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                      <p className="text-[12px] truncate" style={{color:'#525252'}}>{row.shiftName}</p>
                                      {row.otMin>0&&<span className="text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{background:'#FEF3C7',color:'#D97706'}}>OT</span>}
                                    </div>
                                    <span className="text-[12px] font-semibold tabular-nums w-10 text-right flex-shrink-0" style={{color:'#171717'}}>{fmtH(row.hrs)}</span>
                                    <span className="text-[12px] font-bold tabular-nums w-[70px] text-right flex-shrink-0" style={{color:row.salary>0?'#059669':'#D4D4D4'}}>{row.salary>0?`${fmt(Math.round(row.salary))}đ`:'—'}</span>
                                  </div>
                                );
                              })}
                            </div>
                        }
                      </div>
                      {/* Sticky footer total */}
                      {stat.dayRows.length>0 && (
                        <div className="flex items-center gap-2 px-4 py-3" style={{borderTop:'2px solid #E5E5E5',background:'#FAFAFA'}}>
                          <span className="text-[10px] font-semibold uppercase tracking-widest w-14 flex-shrink-0" style={{color:'#737373'}}>Tổng</span>
                          <span className="flex-1 text-[12px] font-bold" style={{color:'#171717'}}>{stat.cnt} ca{stat.otMin>0&&<span className="ml-1.5 text-[10px] font-bold" style={{color:'#D97706'}}>+{stat.otMin}ph OT</span>}</span>
                          <span className="text-[12px] font-bold tabular-nums w-10 text-right flex-shrink-0" style={{color:'#171717'}}>{fmtH(stat.hrs)}</span>
                          <span className="text-[13px] font-bold tabular-nums w-[70px] text-right flex-shrink-0" style={{color:'#059669'}}>{stat.base>0?`${fmt(Math.round(stat.base))}đ`:'—'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}


        {/* ─────── MY_SALARY VIEW (Staff) ─────── */}
        {viewMode === 'MY_SALARY' && currentUser?.role === 'STAFF' && (() => {
          const me = currentUser;
          const ps = (t: string) => { const m = t?.trim().match(/^(\d{1,2})(?:[:h](\d{1,2}))?/); return m ? parseInt(m[1]) + (m[2] ? parseInt(m[2]) : 0) / 60 : 0; };
          const calcHs = (shift: Shift, sa: { timeLabel?: string; overtimeMinutes?: number }) => {
            let base = 0;
            if (sa.timeLabel) { const p2 = sa.timeLabel.split(/\s*-\s*/); if (p2.length===2) { const s2=ps(p2[0]); const e2=ps(p2[1]); base=e2-s2; if(base<0) base+=24; } }
            else { const s2=ps(shift.startTime); const e2=ps(shift.endTime); base=e2-s2; if(base<0) base+=24; if(base===0) base=4; }
            return base + (sa.overtimeMinutes||0)/60;
          };
          const getSDs = (item: ScheduleItem): Date|null => {
            const wm = item.weekId?.match(/^(\d{4})-(\d{2})-W(\d{1,2})$/);
            if (!wm) return null;
            const yr=parseInt(wm[1]),mo=parseInt(wm[2])-1,wk=parseInt(wm[3]);
            const d1=new Date(yr,mo,1); const dow=d1.getDay()===0?6:d1.getDay()-1;
            const mon1=new Date(yr,mo,1-dow+(wk-1)*7);
            return new Date(mon1.getTime()+item.dayIndex*86400000);
          };
          // isShiftDone — only count completed shifts
          const isShiftDone2 = (item: ScheduleItem, shift: Shift): boolean => {
            const d = getSDs(item); if (!d) return false;
            const endH = ps(shift.endTime); const startH = ps(shift.startTime);
            const endDate = new Date(d);
            if (endH <= startH) endDate.setDate(endDate.getDate() + 1);
            endDate.setHours(Math.floor(endH), Math.round((endH % 1) * 60), 0, 0);
            return endDate.getTime() <= Date.now();
          };
          const myItems = schedule.filter(item => {
            const sa = item.streamerAssignments.find(a => a.userId === me.id); if (!sa) return false;
            const d = getSDs(item);
            if (!d || d.getMonth()!==timekeepingMonth-1 || d.getFullYear()!==timekeepingYear) return false;
            const shift = shifts.find(s => s.id===item.shiftId);
            return shift ? isShiftDone2(item, shift) : false;
          });
          let totalH=0; let totalOT=0;
          const rows = myItems.map(item => {
            const shift = shifts.find(s => s.id===item.shiftId)!;
            const sa = item.streamerAssignments.find(a => a.userId===me.id)!;
            const hrs = calcHs(shift,sa); totalH+=hrs; totalOT+=sa.overtimeMinutes||0;
            return { shift, sa, hrs, date: getSDs(item), salary: hrs*(me.hourlyRate||0) };
          }).sort((a,b)=>(a.date?.getTime()||0)-(b.date?.getTime()||0));
          const baseSal = totalH*(me.hourlyRate||0);
          const fmts = (n:number) => n.toLocaleString('vi-VN');
          const fmtHs = (h:number) => h%1===0?`${h}h`:`${h.toFixed(1)}h`;
          const months3 = Array.from({length:12},(_,i)=>i+1);
          const years3 = [new Date().getFullYear()-1, new Date().getFullYear()];
          const dayN = ['CN','T2','T3','T4','T5','T6','T7'];
          let runningTotal = 0;

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <img src={me.avatar} className="w-10 h-10 rounded-2xl object-cover flex-shrink-0" style={{border:'2px solid #E5E5E5'}} alt=""/>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-bold truncate" style={{color:'#171717'}}>Lương của {me.name.split(' ').pop()}</h3>
                  <p className="text-[11px]" style={{color:'#A3A3A3'}}>{(me.hourlyRate||0)>0?`${fmts(me.hourlyRate!)}đ/giờ`:'Chưa cài lương'}</p>
                </div>
              </div>

              {/* Month selector */}
              <div className="flex gap-2">
                <select className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none" style={{background:'#fff',border:'1px solid #E5E5E5'}} value={timekeepingMonth} onChange={e=>setTimekeepingMonth(Number(e.target.value))}>
                  {months3.map(m=><option key={m} value={m}>Tháng {m}</option>)}
                </select>
                <select className="px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none" style={{background:'#fff',border:'1px solid #E5E5E5'}} value={timekeepingYear} onChange={e=>setTimekeepingYear(Number(e.target.value))}>
                  {years3.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {label:'Số ca',value:`${rows.length}`,color:'#4F46E5'},
                  {label:'Tổng giờ',value:fmtHs(totalH),sub:totalOT>0?`+${totalOT}ph OT`:undefined,color:'#0891B2'},
                  {label:'Thu nhập',value:baseSal>0?`${fmts(Math.round(baseSal/1000))}k`:'—',color:'#059669'},
                ].map((s,i)=>(
                  <div key={i} className="py-2.5 px-2 rounded-xl text-center" style={{background:'#fff',border:'1px solid #F0F0F0'}}>
                    <p className="text-[18px] font-bold tabular-nums leading-tight" style={{color:s.color}}>{s.value}</p>
                    <p className="text-[8px] font-semibold uppercase tracking-widest mt-0.5" style={{color:'#A3A3A3'}}>{s.label}</p>
                    {s.sub&&<p className="text-[8px] mt-0.5" style={{color:'#D97706'}}>{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Shift list — card style */}
              {rows.length===0 ? (
                <div className="bg-white rounded-2xl border py-12 text-center" style={{borderColor:'#E5E5E5'}}>
                  <Clock size={24} className="mx-auto mb-2" style={{color:'#D4D4D4'}}/>
                  <p className="text-[12px]" style={{color:'#A3A3A3'}}>Chưa có ca hoàn thành trong tháng {timekeepingMonth}/{timekeepingYear}</p>
                  <p className="text-[10px] mt-1" style={{color:'#D4D4D4'}}>Chỉ hiển thị ca đã kết thúc</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{borderBottom:'1px solid #F0F0F0'}}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Ca đã hoàn thành</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{background:'#F0FDF4',color:'#059669'}}>{rows.length} ca</span>
                  </div>
                  {rows.map((r,i)=>{
                    runningTotal += r.salary;
                    const isT = r.date && new Date().toDateString()===r.date.toDateString();
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2.5" style={{borderTop:i>0?'1px solid #F5F5F5':'none',borderLeft:isT?'3px solid #4F46E5':'3px solid transparent'}}>
                        {/* Date */}
                        <div className="w-9 flex-shrink-0 text-center">
                          <p className="text-[13px] font-bold tabular-nums leading-tight" style={{color:isT?'#4F46E5':'#171717'}}>{r.date?.getDate()}</p>
                          <p className="text-[8px] font-semibold uppercase" style={{color:'#A3A3A3'}}>{r.date?dayN[r.date.getDay()]:''}</p>
                        </div>
                        <div className="w-px h-7 flex-shrink-0" style={{background:'#E5E5E5'}}/>
                        {/* Shift info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate" style={{color:'#171717'}}>{r.shift.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono" style={{color:'#A3A3A3'}}>{r.sa.timeLabel||`${r.shift.startTime}–${r.shift.endTime}`}</span>
                            {(r.sa.overtimeMinutes||0)>0&&<span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{background:'#FEF3C7',color:'#D97706'}}>+{r.sa.overtimeMinutes}ph</span>}
                          </div>
                        </div>
                        {/* Hours + salary */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[12px] font-bold tabular-nums" style={{color:r.salary>0?'#059669':'#D4D4D4'}}>{r.salary>0?`${fmts(Math.round(r.salary))}đ`:'—'}</p>
                          <p className="text-[9px] tabular-nums" style={{color:'#A3A3A3'}}>{fmtHs(r.hrs)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Footer total */}
                  <div className="flex items-center justify-between px-4 py-3" style={{borderTop:'2px solid #E5E5E5',background:'#FAFAFA'}}>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Tổng thu nhập</p>
                      <p className="text-[10px]" style={{color:'#D4D4D4'}}>{rows.length} ca · {fmtHs(totalH)}</p>
                    </div>
                    <p className="text-[18px] font-bold tabular-nums" style={{color:'#059669'}}>{baseSal>0?`${fmts(Math.round(baseSal))}đ`:'—'}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}




      </main>


      {/* Assignment Modal (Manager) */}
      <Modal isOpen={isSlotModalOpen} onClose={() => setIsSlotModalOpen(false)} title="Điều phối nhân sự">
        <div className="space-y-4">
           <div className="flex bg-slate-100 p-1 rounded-lg">
             <button className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${slotTab === 'STREAMER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`} onClick={() => setSlotTab('STREAMER')}>Streamer</button>
             <button className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${slotTab === 'OPS' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`} onClick={() => setSlotTab('OPS')}>Vận hành</button>
          </div>

          <div className="max-h-[300px] md:max-h-[350px] overflow-y-auto space-y-2 pr-1 scrollbar-hide">
             {slotTab === 'STREAMER' ? (
                <div className="space-y-2">
                    {users.filter(u => u.role === 'STAFF').map(u => {
                    const current = currentWeekSchedule.find(s => s.dayIndex === editingSlot?.day && s.shiftId === editingSlot?.shiftId);
                    const assignment = current?.streamerAssignments.find(sa => sa.userId === u.id);
                    return (
                        <div key={u.id} className="flex gap-1.5">
                            <button onClick={() => toggleStreamerInSlot(u.id)} className={`flex-1 flex items-center justify-between p-2 md:p-3 rounded-xl border transition-all ${assignment ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}>
                                <div className="flex items-center gap-2 md:gap-3">
                                    <img src={u.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-sm" alt=""/>
                                    <div className="text-left min-w-0">
                                        <p className="font-medium text-xs md:text-sm leading-none truncate">{u.name}</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <RankBadge rank={u.rank} size="sm" />
                                          {assignment?.timeLabel && <p className="text-[8px] md:text-[9px] font-semibold uppercase opacity-80">{assignment.timeLabel}</p>}
                                          {(assignment?.overtimeMinutes || 0) > 0 && (
                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{background:'#FEF3C7', color:'#D97706'}}>+{assignment!.overtimeMinutes}ph</span>
                                          )}
                                        </div>
                                    </div>
                                </div>
                                {assignment && <CheckCircle2 size={16} strokeWidth={3}/>}
                            </button>
                            {/* Kẹp ca button */}
                            <button onClick={() => handleOpenBridgeModal(u.id)} className={`w-10 md:w-11 flex flex-col items-center justify-center rounded-xl border-2 transition-all ${assignment?.timeLabel ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-100 text-slate-300 hover:text-indigo-600 hover:border-indigo-200'}`} title="Kẹp ca">
                                <Layers size={13}/>
                            </button>
                            {/* Thêm giờ button — chỉ hiện khi đã assign */}
                            {assignment && (
                              <button
                                onClick={() => { setOvertimeData({ userId: u.id, minutes: assignment.overtimeMinutes || 0 }); setIsOvertimeModalOpen(true); setIsSlotModalOpen(false); }}
                                className={`w-10 md:w-11 flex flex-col items-center justify-center rounded-xl border-2 transition-all ${
                                  (assignment.overtimeMinutes || 0) > 0 ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-slate-100 text-slate-300 hover:text-amber-500 hover:border-amber-200'
                                }`}
                                title="Thêm giờ live"
                              >
                                <Clock size={13}/>
                              </button>
                            )}
                        </div>
                    );
                    })}
                </div>
             ) : (
                <div className="space-y-2">
                  <button onClick={() => setOpsInSlot(null)} className="w-full p-2.5 rounded-xl border-2 border-dashed border-red-100 text-red-500 font-semibold text-[10px] uppercase hover:bg-red-50 transition-colors">Hủy vận hành</button>
                  {users.filter(u => u.role === 'OPERATIONS').map(u => {
                    const current = currentWeekSchedule.find(s => s.dayIndex === editingSlot?.day && s.shiftId === editingSlot?.shiftId);
                    const isSelected = current?.opsUserId === u.id;
                    return (
                      <button key={u.id} onClick={() => setOpsInSlot(u.id)} className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${isSelected ? 'bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-100' : 'bg-slate-50 border-slate-100 hover:border-orange-300'}`}>
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-sm" alt=""/>
                          <p className="font-medium text-xs md:text-sm leading-none">{u.name}</p>
                        </div>
                        {isSelected && <CheckCircle2 size={16} strokeWidth={3}/>}
                      </button>
                    );
                  })}
                </div>
             )}
          </div>
        </div>
      </Modal>

      {/* Bridge/Kẹp Ca Modal */}
      <Modal isOpen={isBridgeModalOpen} onClose={handleCloseBridgeModal} title="Cấu hình Kẹp Ca">
          {editingSlot && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <img src={users.find(u => u.id === bridgeData.userId)?.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt=""/>
                         <div>
                             <p className="font-medium text-sm text-slate-900">{users.find(u => u.id === bridgeData.userId)?.name}</p>
                             <p className="text-[10px] font-semibold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">Đang cấu hình</p>
                         </div>
                    </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                       <div className="flex-1">
                           <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1 ml-1">Giờ bắt đầu</label>
                           <input type="time" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium shadow-sm" 
                              value={bridgeData.startTime} onChange={e => setBridgeData({...bridgeData, startTime: e.target.value})} />
                       </div>
                       <span className="text-slate-300 font-semibold mt-5">đến</span>
                       <div className="flex-1">
                           <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1 ml-1">Giờ kết thúc</label>
                           <input type="time" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium shadow-sm" 
                              value={bridgeData.endTime} onChange={e => setBridgeData({...bridgeData, endTime: e.target.value})} />
                       </div>
                  </div>
                  <button onClick={() => setBridgeData({...bridgeData, startTime: '', endTime: ''})} className="text-[10px] uppercase font-medium text-slate-400 hover:text-red-500 hover:underline mx-auto block">Xóa cấu hình Kẹp ca</button>
                </div>
                <div className="flex gap-2 pt-2">
                    <Button variant="secondary" className="flex-1 font-medium" onClick={handleCloseBridgeModal}>Hủy</Button>
                    <Button className="flex-1 font-semibold shadow-soft shadow-indigo-100" onClick={handleSaveBridge} icon={<Save size={16}/>}>Lưu cấu hình</Button>
                </div>
              </div>
          )}
      </Modal>

      {/* Overtime / Thêm giờ Modal */}
      <Modal isOpen={isOvertimeModalOpen} onClose={() => { setIsOvertimeModalOpen(false); setIsSlotModalOpen(true); }} title="Thêm giờ live">
        {editingSlot && (() => {
          const u = users.find(x => x.id === overtimeData.userId);
          const shift = shifts.find(s => s.id === editingSlot.shiftId);
          return (
            <div className="space-y-5">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:'#FAFAFA', border:'1px solid #F0F0F0'}}>
                <img src={u?.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt=""/>
                <div>
                  <p className="font-semibold text-[14px]" style={{color:'#171717'}}>{u?.name}</p>
                  <p className="text-[11px] font-mono" style={{color:'#A3A3A3'}}>Ca: {shift?.name} · {shift?.startTime}–{shift?.endTime}</p>
                </div>
              </div>

              {/* Minutes input */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{color:'#A3A3A3'}}>Số phút thêm giờ</label>
                <div className="flex items-center gap-2">
                  {[15, 30, 45, 60, 90].map(m => (
                    <button
                      key={m}
                      onClick={() => setOvertimeData({ ...overtimeData, minutes: m })}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                      style={{
                        background: overtimeData.minutes === m ? '#D97706' : '#F5F5F5',
                        color: overtimeData.minutes === m ? '#fff' : '#737373',
                        border: overtimeData.minutes === m ? '2px solid #D97706' : '2px solid transparent',
                      }}
                    >
                      {m < 60 ? `${m}ph` : `${m/60}h`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="number"
                    min={0} max={480} step={5}
                    className="flex-1 px-4 py-3 rounded-xl text-[14px] font-medium"
                    style={{background:'#F5F5F5', border:'1px solid #E5E5E5', color:'#171717'}}
                    placeholder="Hoặc nhập số phút..."
                    value={overtimeData.minutes || ''}
                    onChange={e => setOvertimeData({ ...overtimeData, minutes: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="text-[13px] font-medium" style={{color:'#A3A3A3'}}>phút</span>
                </div>
                {overtimeData.minutes > 0 && (
                  <p className="text-[12px] mt-2 font-medium" style={{color:'#D97706'}}>
                    ≈ +{(overtimeData.minutes / 60).toFixed(1)}h live thêm
                    {(u?.hourlyRate || 0) > 0 && ` · +${Math.round(overtimeData.minutes / 60 * (u!.hourlyRate || 0)).toLocaleString()}đ`}
                  </p>
                )}
              </div>

              {/* Clear + save */}
              <div className="space-y-2">
                <button onClick={() => setOvertimeData({ ...overtimeData, minutes: 0 })} className="text-[11px] uppercase font-medium block mx-auto" style={{color:'#D4D4D4'}}>Xóa thêm giờ</button>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 font-medium" onClick={() => { setIsOvertimeModalOpen(false); setIsSlotModalOpen(true); }}>Hủy</Button>
                  <Button className="flex-1 font-semibold" onClick={handleSaveOvertime} icon={<Save size={16}/>}>Lưu thêm giờ</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="">
        {(() => {
          const isAdmin = currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN';
          const inputStyle = {background:'#F8F8F8', border:'1.5px solid #EBEBEB', color:'#171717'};
          const focusH = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.border='1.5px solid #4F46E5'; e.currentTarget.style.background='#fff'; };
          const blurH = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.border='1.5px solid #EBEBEB'; e.currentTarget.style.background='#F8F8F8'; };
          return (
          <div className="space-y-0 -mt-2">
            {/* Avatar + Name header */}
            <div className="flex items-center gap-3 pb-4 mb-4" style={{borderBottom:'1px solid #F0F0F0'}}>
              <div className="relative flex-shrink-0">
                {userFormData.avatar ? (
                  <img src={userFormData.avatar} className="w-14 h-14 rounded-2xl object-cover" style={{border:'2px solid #E5E5E5'}} alt=""
                    onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${userFormData.name || 'U'}`; }}/>
                ) : (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[20px] font-bold"
                    style={{background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)', color:'#4F46E5'}}>
                    {userFormData.name ? userFormData.name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{background:'#4F46E5', border:'2px solid #fff'}}>
                  <ImageIcon size={9} color="#fff"/>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold truncate" style={{color:'#171717'}}>
                  {userFormData.name || (isEditUser ? 'Chỉnh sửa' : 'Nhân sự mới')}
                </p>
                {userFormData.id && <p className="text-[11px] font-mono" style={{color:'#A3A3A3'}}>@{userFormData.id}</p>}
                <p className="text-[10px] mt-0.5" style={{color:'#D4D4D4'}}>{isEditUser ? 'Chỉnh sửa thông tin' : 'Tạo tài khoản mới'}</p>
              </div>
            </div>

            {/* Section 1: Thông tin cơ bản */}
            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-1.5">
                <Edit2 size={11} style={{color:'#A3A3A3'}}/>
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Thông tin cơ bản</p>
              </div>
              <input type="text" className="w-full py-2.5 px-3.5 rounded-xl text-[13px] font-medium outline-none transition-all" style={inputStyle}
                value={userFormData.name || ''} onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                placeholder="Họ và tên" onFocus={focusH} onBlur={blurH}/>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" className="w-full py-2.5 px-3.5 rounded-xl text-[13px] font-mono outline-none transition-all" style={inputStyle}
                  value={userFormData.id || ''} onChange={e => setUserFormData({...userFormData, id: e.target.value})}
                  placeholder="Mã đăng nhập" onFocus={focusH} onBlur={blurH}/>
                <input type="text" className="w-full py-2.5 px-3.5 rounded-xl text-[13px] font-mono outline-none transition-all" style={inputStyle}
                  value={userFormData.password || ''} onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder="Mật khẩu" onFocus={focusH} onBlur={blurH}/>
              </div>
              <input type="text" className="w-full py-2.5 px-3.5 rounded-xl text-[12px] font-medium outline-none transition-all" style={inputStyle}
                value={userFormData.avatar || ''} onChange={e => setUserFormData({...userFormData, avatar: e.target.value})}
                placeholder="Link ảnh đại diện (https://...)" onFocus={focusH} onBlur={blurH}/>
              <input type="text" className="w-full py-2.5 px-3.5 rounded-xl text-[13px] font-medium outline-none transition-all" style={inputStyle}
                value={userFormData.zaloPhone || ''} onChange={e => setUserFormData({...userFormData, zaloPhone: e.target.value})}
                placeholder="Số Zalo (tuỳ chọn)" onFocus={focusH} onBlur={blurH}/>
            </div>

            {/* Section 2: Vai trò & Rank — admin only */}
            {isAdmin && (
            <div className="mb-4 space-y-2.5" style={{paddingTop:'12px',borderTop:'1px solid #F0F0F0'}}>
              <div className="flex items-center gap-1.5">
                <Award size={11} style={{color:'#A3A3A3'}}/>
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Vai trò & Rank</p>
              </div>
              {/* Role chips */}
              <div className="flex gap-1.5">
                {([
                  { value: 'STAFF', label: 'Mẫu Live', icon: <Video size={12}/>, color: '#4F46E5', bg: '#EEF2FF' },
                  { value: 'OPERATIONS', label: 'Kỹ thuật', icon: <Wrench size={12}/>, color: '#D97706', bg: '#FEF3C7' },
                  { value: 'MANAGER', label: 'Quản lý', icon: <Shield size={12}/>, color: '#059669', bg: '#DCFCE7' },
                ] as const).map(({ value, label, icon, color, bg }) => {
                  const active = userFormData.role === value;
                  return (
                    <button key={value} onClick={() => setUserFormData({...userFormData, role: value as Role})}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all"
                      style={{background: active ? bg : '#F5F5F5', border: active ? `1.5px solid ${color}` : '1.5px solid transparent', color: active ? color : '#A3A3A3'}}>
                      {icon}{label}
                    </button>
                  );
                })}
              </div>
              {/* Rank chips — only for STAFF */}
              {userFormData.role === 'STAFF' && (
                <div className="flex gap-1.5">
                  {([
                    { r: 'S', label: 'Super', color: '#9333EA', bg: '#F5F3FF' },
                    { r: 'A', label: 'Pro', color: '#2563EB', bg: '#EFF6FF' },
                    { r: 'B', label: 'Good', color: '#0891B2', bg: '#ECFEFF' },
                    { r: 'C', label: 'New', color: '#737373', bg: '#F5F5F5' },
                  ] as const).map(({ r, label, color, bg }) => {
                    const active = userFormData.rank === r;
                    return (
                      <button key={r} onClick={() => setUserFormData({...userFormData, rank: r as Rank})}
                        className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all"
                        style={{background: active ? bg : '#F8F8F8', border: active ? `1.5px solid ${color}` : '1.5px solid transparent', color: active ? color : '#C3C3C3'}}>
                        <span className="text-[14px] font-black leading-none">{r}</span>
                        <span className="text-[7px] font-semibold uppercase mt-0.5">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Section 3: Nền tảng — admin only */}
            {isAdmin && (
            <div className="mb-4 space-y-2.5" style={{paddingTop:'12px',borderTop:'1px solid #F0F0F0'}}>
              <div className="flex items-center gap-1.5">
                <Monitor size={11} style={{color:'#A3A3A3'}}/>
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Nền tảng live</p>
              </div>
              <div className="flex gap-2">
                {(['tiktok', 'shopee'] as Platform[]).map(p => {
                  const cfg = PLATFORM_CONFIG[p];
                  const isSelected = (userFormData.platforms || []).includes(p);
                  return (
                    <button key={p} onClick={() => {
                      const current = userFormData.platforms || [];
                      const next = isSelected ? current.filter(x => x !== p) : [...current, p];
                      setUserFormData({...userFormData, platforms: next.length > 0 ? next : [p]});
                    }}
                      className="flex-1 flex items-center gap-2 p-2.5 rounded-xl transition-all"
                      style={{background: isSelected ? cfg.bgLight : '#F8F8F8', border: isSelected ? `1.5px solid ${cfg.color}` : '1.5px solid transparent'}}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{background: isSelected ? cfg.color + '20' : '#EBEBEB'}}>
                        <PlatformIcon platform={p} size={14} />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-semibold" style={{color: isSelected ? cfg.color : '#737373'}}>{cfg.label}</p>
                        <p className="text-[8px]" style={{color: isSelected ? cfg.color + 'AA' : '#C3C3C3'}}>{isSelected ? '✓ Chọn' : 'Chưa'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Section 4: Lương — admin + STAFF only */}
            {isAdmin && userFormData.role === 'STAFF' && (
            <div className="mb-4 space-y-2.5" style={{paddingTop:'12px',borderTop:'1px solid #F0F0F0'}}>
              <div className="flex items-center gap-1.5">
                <TrendingUp size={11} style={{color:'#059669'}}/>
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Lương theo giờ</p>
                {(userFormData.hourlyRate || 0) > 0 && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'#DCFCE7',color:'#059669'}}>
                    ≈ {((userFormData.hourlyRate || 0) * 4).toLocaleString()}đ/ca
                  </span>
                )}
              </div>
              <div className="relative">
                <input type="number" className="w-full py-2.5 px-3.5 rounded-xl text-[14px] font-bold outline-none transition-all"
                  style={{background:'#F0FDF4', border:'1.5px solid #BBF7D0', color:'#065F46'}}
                  value={userFormData.hourlyRate || ''} onChange={e => setUserFormData({...userFormData, hourlyRate: Number(e.target.value)})}
                  placeholder="0" onFocus={e => { e.currentTarget.style.border='1.5px solid #059669'; }} onBlur={e => { e.currentTarget.style.border='1.5px solid #BBF7D0'; }}/>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold" style={{color:'#059669'}}>đ/giờ</span>
              </div>
            </div>
            )}

            {/* Save footer */}
            <div className="flex gap-2 pt-2" style={{borderTop:'1px solid #F0F0F0'}}>
              <button onClick={() => setIsUserModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                style={{border:'1.5px solid #E5E5E5', color:'#737373'}}>
                Hủy
              </button>
              <button onClick={handleSaveUser}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                style={{background:'#4F46E5', color:'#fff', boxShadow:'0 4px 12px #4F46E540'}}>
                <Save size={13}/>{isEditUser ? 'Lưu' : 'Thêm'}
              </button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* Shift Edit Modal */}
      <Modal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} title={shiftFormData.id ? "Sửa Ca Live" : "Thêm Ca Live Mới"}>
         <div className="space-y-4">
             <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5 ml-1">Thông tin Ca</label>
                <div className="space-y-3">
                   <div className="grid grid-cols-3 gap-3">
                      <input type="text" disabled={!!shiftFormData.id && shiftFormData.id !== '' && shifts.some(s => s.id === shiftFormData.id)} className="col-span-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium uppercase" value={shiftFormData.id} onChange={e => setShiftFormData({...shiftFormData, id: e.target.value})} placeholder="Mã (VD: ca1)..." />
                      <input type="text" className="col-span-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium" value={shiftFormData.name} onChange={e => setShiftFormData({...shiftFormData, name: e.target.value})} placeholder="Tên ca (VD: Ca Sáng)..." />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium" value={shiftFormData.startTime} onChange={e => setShiftFormData({...shiftFormData, startTime: e.target.value})} />
                      <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium" value={shiftFormData.endTime} onChange={e => setShiftFormData({...shiftFormData, endTime: e.target.value})} />
                   </div>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5 ml-1">Màu sắc hiển thị</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                   <button onClick={() => setShiftFormData({...shiftFormData, color: 'bg-orange-100 text-orange-800 border-orange-200'})} className={`p-3 rounded-xl border-2 bg-orange-100 text-orange-800 border-orange-200 ${shiftFormData.color.includes('orange') ? 'ring-2 ring-orange-400' : ''}`}>Cam (Sáng)</button>
                   <button onClick={() => setShiftFormData({...shiftFormData, color: 'bg-blue-100 text-blue-800 border-blue-200'})} className={`p-3 rounded-xl border-2 bg-blue-100 text-blue-800 border-blue-200 ${shiftFormData.color.includes('blue') ? 'ring-2 ring-blue-400' : ''}`}>Xanh Dương (Chiều)</button>
                   <button onClick={() => setShiftFormData({...shiftFormData, color: 'bg-purple-100 text-purple-800 border-purple-200'})} className={`p-3 rounded-xl border-2 bg-purple-100 text-purple-800 border-purple-200 ${shiftFormData.color.includes('purple') ? 'ring-2 ring-purple-400' : ''}`}>Tím (Tối)</button>
                   <button onClick={() => setShiftFormData({...shiftFormData, color: 'bg-indigo-100 text-indigo-800 border-indigo-200'})} className={`p-3 rounded-xl border-2 bg-indigo-100 text-indigo-800 border-indigo-200 ${shiftFormData.color.includes('indigo') ? 'ring-2 ring-indigo-400' : ''}`}>Indigo (Đêm)</button>
                </div>
             </div>
             <div className="pt-2 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setIsShiftModalOpen(false)}>Hủy</Button>
                <Button className="flex-1" onClick={handleSaveShift} icon={<Save size={16}/>}>Lưu</Button>
             </div>
         </div>
      </Modal>

      {/* Staff Request Modal */}
      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Gửi yêu cầu điều chỉnh">
        <div className="space-y-4">
          <div className="space-y-3">
             <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 ml-1">Hình thức</label>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setRequestForm({...requestForm, type: 'SWAP'})} className={`p-3 rounded-xl border-2 font-semibold text-[10px] uppercase ${requestForm.type === 'SWAP' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>Thay đổi nhân sự</button>
                   <button onClick={() => setRequestForm({...requestForm, type: 'LEAVE'})} className={`p-3 rounded-xl border-2 font-semibold text-[10px] uppercase ${requestForm.type === 'LEAVE' ? 'bg-red-600 text-white' : 'bg-white'}`}>Xin nghỉ ca</button>
                </div>
             </div>
              {requestForm.type === 'SWAP' && (
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium" value={requestForm.targetUserId || ''} onChange={e => setRequestForm({...requestForm, targetUserId: e.target.value})}>
                     <option value="">-- Chọn đồng nghiệp --</option>
                     {users.filter(u => u.id !== currentUser?.id && u.role === (currentUser?.role === 'OPERATIONS' ? 'OPERATIONS' : 'STAFF')).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
             <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium resize-none" value={requestForm.reason} onChange={e => setRequestForm({...requestForm, reason: e.target.value})} placeholder="Lý do..."></textarea>
          </div>
          <div className="pt-4 flex gap-2">
              <Button variant="secondary" size="md" className="flex-1 font-medium" onClick={() => setIsRequestModalOpen(false)}>Hủy</Button>
              <Button size="md" className="flex-1 font-semibold" onClick={createRequest} icon={<Send size={16}/>}>Gửi Yêu Cầu</Button>
          </div>
        </div>
      </Modal>

      {/* ── Notification Slide-Over Panel ─────────────────────────── */}
      {isNotifPanelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setIsNotifPanelOpen(false)} />
          <div className="relative ml-auto w-full sm:w-[400px] bg-white flex flex-col shadow-2xl h-full" style={{animation:'slideInRight 0.2s ease-out'}}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3" style={{borderBottom:'1px solid #F0F0F0', background: '#FAFAFA'}}>
              <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Bell size={20} style={{color:'#171717'}} />
                  <h3 className="text-[17px] font-medium whitespace-nowrap" style={{color:'#171717'}}>Thông báo</h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500 text-white whitespace-nowrap">{unreadCount}</span>
                  )}
                </div>
                <button onClick={() => setIsNotifPanelOpen(false)} className="sm:hidden p-2 rounded-xl bg-white shadow-sm border border-slate-200"><X size={18} style={{color:'#171717'}} /></button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {unreadCount > 0 && (
                  <button onClick={markAllNotifsRead} className="flex-1 sm:flex-none text-[12px] font-medium text-center py-2.5 sm:py-0 text-blue-600 bg-blue-50 sm:bg-transparent rounded-lg sm:rounded-none">Đọc tất cả</button>
                )}
                {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                  <button onClick={() => setIsNotifModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:bg-slate-800" style={{background:'#171717', color:'#fff'}}>
                    <Plus size={14} /> Gửi Thông báo
                  </button>
                )}
                <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                <button onClick={() => setIsNotifPanelOpen(false)} className="hidden sm:flex p-2 rounded-xl hover:bg-slate-200 transition-colors"><X size={18} style={{color:'#737373'}} /></button>
              </div>
            </div>
            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {myNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{background:'#F5F5F5'}}>
                    <Bell size={20} style={{color:'#D4D4D4'}} />
                  </div>
                  <p className="text-[13px] font-semibold" style={{color:'#A3A3A3'}}>Chưa có thông báo nào</p>
                </div>
              ) : (
                <div className="divide-y" style={{borderColor:'#F5F5F5'}}>
                  {myNotifications.map(notif => {
                    const isRead = (notif.readBy || []).includes(currentUser?.id || '');
                    const timeAgo = (() => {
                      const mins = Math.floor((Date.now() - notif.createdAt) / 60000);
                      if (mins < 1) return 'Vừa xong';
                      if (mins < 60) return `${mins} phút trước`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs} giờ trước`;
                      return `${Math.floor(hrs / 24)} ngày trước`;
                    })();
                    const iconColor = notif.type === 'ANNOUNCEMENT' ? '#2563EB'
                      : notif.type === 'REQUEST_APPROVED' ? '#16A34A'
                      : notif.type === 'REQUEST_REJECTED' ? '#EF4444'
                      : notif.type === 'REQUEST_NEW' ? '#F59E0B'
                      : '#6366F1';
                    return (
                      <div key={notif.id}
                        onClick={() => {
                          if (!isRead) markNotifRead(notif.id);
                          setSelectedNotification(notif);
                        }}
                        className="flex gap-3 p-4 cursor-pointer transition-colors hover:bg-slate-50"
                        style={{background: isRead ? 'transparent' : '#FAFBFF'}}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background: `${iconColor}15`}}>
                          <Bell size={14} style={{color: iconColor}} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-medium truncate" style={{color:'#171717'}}>{notif.title}</p>
                            {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                          </div>
                          {notif.message !== notif.title && (
                            <p className="text-[11px] mt-0.5 leading-relaxed" style={{color:'#737373'}}>{notif.message}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {notif.platform && <PlatformBadge platform={notif.platform} size="sm" />}
                            <span className="text-[10px]" style={{color:'#A3A3A3'}}>{timeAgo}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Announcement Modal (Manager) ─────────────────────────── */}
      <Modal isOpen={isNotifModalOpen} onClose={() => setIsNotifModalOpen(false)} title="Gửi thông báo">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5 ml-1">Tiêu đề</label>
            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium" value={notifFormData.title} onChange={e => setNotifFormData({...notifFormData, title: e.target.value})} placeholder="VD: Nhắc đăng ký lịch live..." />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1.5 ml-1">Nội dung</label>
            <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium resize-none" value={notifFormData.message} onChange={e => setNotifFormData({...notifFormData, message: e.target.value})} placeholder="Nội dung thông báo..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsNotifModalOpen(false)}>Hủy</Button>
            <Button className="flex-1" onClick={() => {
              if (!notifFormData.title || !notifFormData.message) { alert('Vui lòng nhập tiêu đề và nội dung!'); return; }
              addNotification({
                type: 'ANNOUNCEMENT',
                title: notifFormData.title,
                message: notifFormData.message,
                platform: activePlatform,
                brandId: activeBrandSlug || undefined,
                createdBy: currentUser?.id,
              });
              setNotifFormData({ title: '', message: '' });
              setIsNotifModalOpen(false);
              alert('Đã gửi thông báo đến tất cả nhân sự!');
            }} icon={<Send size={14} />}>Gửi thông báo</Button>
          </div>
        </div>
      </Modal>

      {/* ── Detailed Notification Modal ─────────────────────────── */}
      <Modal isOpen={!!selectedNotification} onClose={() => setSelectedNotification(null)} title="Chi tiết thông báo">
        {selectedNotification && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4" style={{borderBottom:'1px solid #F0F0F0'}}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{background: '#EFF6FF'}}>
                <Bell size={18} style={{color: '#2563EB'}} />
              </div>
              <div>
                <h4 className="text-[15px] font-medium" style={{color:'#171717'}}>{selectedNotification.title}</h4>
                <p className="text-[11px] mt-0.5" style={{color:'#A3A3A3'}}>
                  {new Date(selectedNotification.createdAt).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              </div>
            </div>
            
            <div className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{color:'#404040'}}>
              {selectedNotification.message}
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setSelectedNotification(null)} className="px-6">Đóng</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      {currentUser && (() => {
        const isManager = currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN';
        const isStaff = currentUser.role === 'STAFF';
        const isOps = currentUser.role === 'OPERATIONS';

        // Helper: tab button
        const Tab = ({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) => (
          <button
            onClick={onClick}
            className={`flex flex-col items-center gap-[3px] flex-1 py-1.5 mx-0.5 rounded-xl transition-all active:scale-95 ${active ? 'text-indigo-500' : 'text-slate-400'}`}
          >
            <span className="relative">
              {icon}
              {badge && badge > 0 ? <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 border border-white"/> : null}
            </span>
            <span className={`text-[9px] leading-none mt-0.5 ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
          </button>
        );

        // Action sheet row item
        const SheetItem = ({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color?: string; onClick: () => void }) => (
          <button
            onClick={onClick}
            className="w-full flex items-center gap-4 px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
            style={{ color: color || '#262626' }}
          >
            <span style={{ color: color || '#4F46E5', opacity: 0.85 }}>{icon}</span>
            <span className="text-[14px] font-medium">{label}</span>
          </button>
        );

        return (
          <>
            {/* Action sheet backdrop */}
            {isMoreMenuOpen && (
              <div
                className="md:hidden fixed inset-0 z-[60] bg-black/20 backdrop-blur-[1px]"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <div
                  className="absolute bottom-[68px] left-3 right-3 rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.98)', boxShadow: '0 -2px 32px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)' }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Sheet handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-8 h-1 rounded-full bg-slate-200"/>
                  </div>

                  {/* User info row */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                    <img src={currentUser.avatar} className="w-9 h-9 rounded-full object-cover" alt=""/>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{currentUser.name}</p>
                      <p className="text-[11px] text-slate-400">{isManager ? 'Quản lý' : isStaff ? 'Mẫu live' : 'Vận hành'}</p>
                    </div>
                    <button onClick={() => setIsMoreMenuOpen(false)} className="ml-auto w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>

                  {/* Menu items — depends on role */}
                  <div className="py-1 divide-y divide-slate-50">
                    {isManager && (
                      <SheetItem icon={<Settings size={18}/>} label="Cấu hình" onClick={() => { setViewMode('SETTINGS'); setIsMoreMenuOpen(false); }}/>
                    )}
                    {isManager && (
                      <SheetItem icon={<Inbox size={18}/>} label={`Yêu cầu${pendingCount > 0 ? ` (${pendingCount})` : ''}`} onClick={() => { setViewMode('REQUESTS'); setIsMoreMenuOpen(false); }}/>
                    )}
                    {isManager && (
                      <SheetItem icon={<Bell size={18}/>} label={`Thông báo${unreadCount > 0 ? ` (${unreadCount})` : ''}`} onClick={() => { setIsNotifPanelOpen(true); setIsMoreMenuOpen(false); }}/>
                    )}
                    {isStaff && (
                      <SheetItem icon={<Bell size={18}/>} label={`Thông báo${unreadCount > 0 ? ` (${unreadCount})` : ''}`} onClick={() => { setIsNotifPanelOpen(true); setIsMoreMenuOpen(false); }}/>
                    )}
                    {isOps && (<>
                      <SheetItem icon={<Settings size={18}/>} label="Cấu hình" onClick={() => { setViewMode('SETTINGS'); setIsMoreMenuOpen(false); }}/>
                      <SheetItem icon={<Bell size={18}/>} label={`Thông báo${unreadCount > 0 ? ` (${unreadCount})` : ''}`} onClick={() => { setIsNotifPanelOpen(true); setIsMoreMenuOpen(false); }}/>
                    </>)}
                  </div>

                  {/* Logout — always last */}
                  <div className="border-t border-slate-100">
                    <SheetItem icon={<LogOut size={18}/>} label="Đăng xuất" color="#EF4444" onClick={() => { handleLogout(); setIsMoreMenuOpen(false); }}/>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom tab bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bottom-menu z-50">
              <div className="bottom-nav-bar flex justify-around items-center px-1 pt-1.5">

                {/* ── MANAGER / SUPER_ADMIN ── */}
                {isManager && (<>
                  <Tab icon={<Calendar size={21} strokeWidth={viewMode==='DASHBOARD'&&!isMoreMenuOpen?2:1.5}/>} label="Lịch" active={viewMode==='DASHBOARD'&&!isMoreMenuOpen} onClick={()=>{setViewMode('DASHBOARD');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<Users size={21} strokeWidth={viewMode==='STAFF_MANAGEMENT'&&!isMoreMenuOpen?2:1.5}/>} label="Nhân sự" active={viewMode==='STAFF_MANAGEMENT'&&!isMoreMenuOpen} onClick={()=>{setViewMode('STAFF_MANAGEMENT');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<CalendarCheck size={21} strokeWidth={viewMode==='TIMEKEEPING'&&!isMoreMenuOpen?2:1.5}/>} label="Chấm công" active={viewMode==='TIMEKEEPING'&&!isMoreMenuOpen} onClick={()=>{setViewMode('TIMEKEEPING');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<BarChart3 size={21} strokeWidth={viewMode==='REPORTS'&&!isMoreMenuOpen?2:1.5}/>} label="Báo cáo" active={viewMode==='REPORTS'&&!isMoreMenuOpen} onClick={()=>{setViewMode('REPORTS');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<MoreHorizontal size={21} strokeWidth={isMoreMenuOpen?2:1.5}/>} label="Thêm" active={isMoreMenuOpen} onClick={()=>setIsMoreMenuOpen(!isMoreMenuOpen)}/>
                </>)}

                {/* ── STAFF ── */}
                {isStaff && (<>
                  <Tab icon={<Calendar size={21} strokeWidth={viewMode==='DASHBOARD'&&!isMoreMenuOpen?2:1.5}/>} label="Lịch" active={viewMode==='DASHBOARD'&&!isMoreMenuOpen} onClick={()=>{setViewMode('DASHBOARD');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<CheckCircle2 size={21} strokeWidth={viewMode==='MY_AVAILABILITY'&&!isMoreMenuOpen?2:1.5}/>} label="Đăng ký" active={viewMode==='MY_AVAILABILITY'&&!isMoreMenuOpen} onClick={()=>{setViewMode('MY_AVAILABILITY');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<TrendingUp size={21} strokeWidth={viewMode==='MY_SALARY'&&!isMoreMenuOpen?2:1.5}/>} label="Lương" active={viewMode==='MY_SALARY'&&!isMoreMenuOpen} onClick={()=>{setViewMode('MY_SALARY');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<Inbox size={21} strokeWidth={viewMode==='REQUESTS'&&!isMoreMenuOpen?2:1.5}/>} label="Yêu cầu" active={viewMode==='REQUESTS'&&!isMoreMenuOpen} onClick={()=>{setViewMode('REQUESTS');setIsMoreMenuOpen(false);}} badge={pendingCount}/>
                  <Tab icon={<MoreHorizontal size={21} strokeWidth={isMoreMenuOpen?2:1.5}/>} label="Thêm" active={isMoreMenuOpen} onClick={()=>setIsMoreMenuOpen(!isMoreMenuOpen)}/>
                </>)}

                {/* ── OPERATIONS ── */}
                {isOps && (<>
                  <Tab icon={<Calendar size={21} strokeWidth={viewMode==='DASHBOARD'&&!isMoreMenuOpen?2:1.5}/>} label="Lịch" active={viewMode==='DASHBOARD'&&!isMoreMenuOpen} onClick={()=>{setViewMode('DASHBOARD');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<Users size={21} strokeWidth={viewMode==='STAFF_MANAGEMENT'&&!isMoreMenuOpen?2:1.5}/>} label="Nhân sự" active={viewMode==='STAFF_MANAGEMENT'&&!isMoreMenuOpen} onClick={()=>{setViewMode('STAFF_MANAGEMENT');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<Inbox size={21} strokeWidth={viewMode==='REQUESTS'&&!isMoreMenuOpen?2:1.5}/>} label="Yêu cầu" active={viewMode==='REQUESTS'&&!isMoreMenuOpen} onClick={()=>{setViewMode('REQUESTS');setIsMoreMenuOpen(false);}} badge={pendingCount}/>
                  <Tab icon={<BarChart3 size={21} strokeWidth={viewMode==='REPORTS'&&!isMoreMenuOpen?2:1.5}/>} label="Báo cáo" active={viewMode==='REPORTS'&&!isMoreMenuOpen} onClick={()=>{setViewMode('REPORTS');setIsMoreMenuOpen(false);}}/>
                  <Tab icon={<MoreHorizontal size={21} strokeWidth={isMoreMenuOpen?2:1.5}/>} label="Thêm" active={isMoreMenuOpen} onClick={()=>setIsMoreMenuOpen(!isMoreMenuOpen)}/>
                </>)}

              </div>
            </nav>
          </>
        );
      })()}

    </div>

      {/* Salary Detail Modal */}
      {salaryDetailUser && (
        <SalaryDetailModal
          user={salaryDetailUser}
          schedule={schedule}
          shifts={shifts}
          weekDates={[weekDates]}
          onClose={() => setSalaryDetailUser(null)}
          monthLabel={`Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}
        />
      )}

    </>
  );
}

const SidebarItem = ({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) => (
  <button
    onClick={onClick}
    className={`sidebar-link w-full flex items-center justify-between${active ? ' active' : ''}`}
  >
    <div className="flex items-center gap-2.5">
      <span className="sidebar-icon">{icon}</span>
      <span>{label}</span>
    </div>
    {badge !== undefined && (
      <span className="w-4 h-4 text-white text-[9px] font-medium rounded-full flex items-center justify-center" style={{background:'#EF4444'}}>
        {badge}
      </span>
    )}
  </button>
);
