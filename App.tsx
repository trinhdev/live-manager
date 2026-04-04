
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Clock, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Wrench,
  CheckCircle2,
  XCircle,
  MessageSquare,
  History,
  Info,
  Link as LinkIcon,
  Layers,
  ArrowRightLeft,
  Bell,
  MessageCircle,
  Send,
  Key,
  RefreshCw,
  Check,
  MousePointer2,
  CalendarCheck,
  UserPlus,
  Save,
  Mic2,
  Shield,
  Gem,
  Award,
  Crown,
  Star,
  ListTodo,
  RotateCcw,
  FileSpreadsheet,
  Download,
  BarChart3,
  Loader2,
  LogIn,
  Menu,
  X,
  Palette,
  Bot,
  AlertTriangle
} from 'lucide-react';
import { User, Brand, Shift, Availability, ScheduleItem, ViewMode, Rank, Role, ShiftRequest, RequestStatus, RequestType } from './types';
import { DAYS_OF_WEEK } from './constants';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { LoginPage } from './components/LoginPage';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { ZaloService, ZaloConfig } from './services/zalo';
import { api } from './services/api';
import { autoGenerateSchedule } from './services/scheduler';

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
        // If staff, go to availability. If manager, go to dashboard.
        return u.role === 'MANAGER' ? 'DASHBOARD' : 'MY_AVAILABILITY';
      }
    } catch (e) {}
    return 'DASHBOARD';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Mobile day selector for schedule grid
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const today = new Date();
    const d = today.getDay();
    return d === 0 ? 6 : d - 1; // Mon=0 … Sun=6
  });

  // Date Management
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(1);

  const getWeekId = (date: Date, week: number) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}-W${week}`;
  };

  const currentWeekId = useMemo(() => getWeekId(currentDate, currentWeek), [currentDate, currentWeek]);

  // Data State
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
  const [isEditUser, setIsEditUser] = useState(false); // Track if we are editing or creating

  const [editingSlot, setEditingSlot] = useState<{day: number, shiftId: string} | null>(null);
  const [slotTab, setSlotTab] = useState<'STREAMER' | 'OPS'>('STREAMER');
  const [requestForm, setRequestForm] = useState<{type: RequestType, reason: string, targetUserId?: string, slot?: {day: number, shiftId: string}}>({
    type: 'SWAP',
    reason: ''
  });
  const [shiftFormData, setShiftFormData] = useState<Shift>({ id: '', name: '', startTime: '', endTime: '', color: '' });
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
      const uData = await api.getUsers(activeBrandSlug);
      setUsers(uData);

      const [sData, schData, avData, reqData] = await Promise.all([
        api.getShifts(activeBrandSlug),
        api.getSchedule(currentWeekId, activeBrandSlug),
        api.getAvailabilities(currentWeekId, activeBrandSlug),
        api.getRequests(currentWeekId, activeBrandSlug)
      ]);
      setShifts(sData);
      setSchedule(schData);
      setAvailabilities(avData);
      setRequests(reqData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWeekId, activeBrandSlug]); 

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

  // --- Derived Data ---
  const currentWeekSchedule = useMemo(() => schedule, [schedule]);
  const currentWeekAvailabilities = useMemo(() => availabilities, [availabilities]);
  const currentWeekRequests = useMemo(() => requests, [requests]);
  const pendingCount = useMemo(() => requests.filter(r => r.status === 'PENDING').length, [requests]);
  const staffUsers = useMemo(() => users.filter(u => u.role !== 'MANAGER'), [users]);
  const submittedCount = useMemo(() => staffUsers.filter(u => u.isAvailabilitySubmitted).length, [staffUsers]);

  const monthlyStats = useMemo(() => {
    return users.filter(u => u.role !== 'MANAGER').map(u => {
       const shiftCount = schedule.filter(s => 
           s.streamerAssignments.some(sa => sa.userId === u.id) || s.opsUserId === u.id
       ).length;
       const totalHours = shiftCount * 4; 
       return { ...u, shiftCount, totalHours };
    }).sort((a,b) => b.shiftCount - a.shiftCount);
  }, [schedule, users]);


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
      setViewMode(user.role === 'MANAGER' ? 'DASHBOARD' : 'MY_AVAILABILITY');
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
        a => !(a.userId === currentUser.id && a.dayIndex === dayIndex && a.shiftId === shiftId)
      ));
    } else {
      setAvailabilities(prev => [...prev, {
        userId: currentUser.id,
        weekId: currentWeekId,
        dayIndex,
        shiftId
      }]);
    }

    // Sync to backend (fire and forget — không block UI)
    try {
      await api.toggleAvailability({ userId: currentUser.id, dayIndex, shiftId, weekId: currentWeekId, brandId: activeBrandSlug || undefined });
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
      alert('✅ Đã gửi đăng ký! Admin sẽ nhận được thông báo.');
    } catch (e) {
      alert('✅ Đã lưu đăng ký! (Chế độ offline)');
    }
  };

  const handleAutoSchedule = async () => {
    const newItems = autoGenerateSchedule(users, shifts, availabilities, schedule, currentWeekId);
    setIsLoading(true);
    try {
        await api.clearSchedule(currentWeekId); 
        for (const item of newItems) {
            await api.saveScheduleItem(item);
        }
        setSchedule(newItems);
    } catch(e) {
        console.error(e);
        alert("Lỗi lưu lịch tự động");
    } finally {
        setIsLoading(false);
    }
  };

  const createRequest = async () => {
    if (!currentUser || !requestForm.slot) return;
    const shift = shifts.find(s => s.id === requestForm.slot?.shiftId);
    const targetUser = users.find(u => u.id === requestForm.targetUserId);

    const newReq: ShiftRequest = {
      id: `req-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      type: requestForm.type,
      dayIndex: requestForm.slot.day,
      shiftId: requestForm.slot.shiftId,
      weekId: currentWeekId,
      brandId: activeBrandSlug || undefined,
      reason: requestForm.reason,
      targetUserId: requestForm.targetUserId,
      targetUserName: targetUser?.name,
      status: 'PENDING',
      createdAt: Date.now()
    };
    
    try {
        // This INSERT triggers the Webhook to send Zalo message automatically
        await api.createRequest(newReq);
        setRequests([newReq, ...requests]);
        setIsRequestModalOpen(false);
        
        // Removed explicit ZaloService call here to avoid duplicate messages.
        // The Webhook on 'requests' table insert handles the notification.
    } catch (e) {
        alert("Lỗi gửi yêu cầu");
    }
  };

  const handleProcessRequest = async (reqId: string, status: RequestStatus) => {
    try {
        await api.updateRequestStatus(reqId, status);
        const req = requests.find(r => r.id === reqId);
        if (!req) return;

        if (status === 'APPROVED') {
            const existingItem = schedule.find(s => s.dayIndex === req.dayIndex && s.shiftId === req.shiftId && s.weekId === req.weekId);
            if (existingItem) {
                let newItem = { ...existingItem };
                if (req.type === 'LEAVE') {
                    newItem.streamerAssignments = newItem.streamerAssignments.filter(sa => sa.userId !== req.userId);
                    if (newItem.opsUserId === req.userId) newItem.opsUserId = null;
                } else if (req.type === 'SWAP') {
                    if (newItem.opsUserId === req.userId) newItem.opsUserId = req.targetUserId || null;
                    newItem.streamerAssignments = newItem.streamerAssignments.map(sa => 
                        sa.userId === req.userId ? { ...sa, userId: req.targetUserId! } : sa
                    );
                }
                await api.saveScheduleItem(newItem);
                const newSch = await api.getSchedule(currentWeekId, activeBrandSlug || undefined);
                setSchedule(newSch);
            }
        }
        const newReqs = await api.getRequests(currentWeekId, activeBrandSlug || undefined);
        setRequests(newReqs);

    } catch (e) {
        alert("Lỗi xử lý yêu cầu");
    }
  };

  const toggleStreamerInSlot = async (userId: string) => {
    if (!editingSlot) return;
    const existingItem = schedule.find(s => s.dayIndex === editingSlot.day && s.shiftId === editingSlot.shiftId && s.weekId === currentWeekId);
    
    let newItem: ScheduleItem;
    
    if (existingItem) {
        newItem = { ...existingItem };
        const idx = newItem.streamerAssignments.findIndex(s => s.userId === userId);
        if (idx > -1) {
            newItem.streamerAssignments.splice(idx, 1);
        } else {
            if (newItem.streamerAssignments.length >= 2) return alert('Tối đa 2 Streamer!');
            newItem.streamerAssignments.push({ userId });
        }
    } else {
        newItem = {
            id: `${currentWeekId}-${editingSlot.day}-${editingSlot.shiftId}`,
            dayIndex: editingSlot.day,
            shiftId: editingSlot.shiftId,
            weekId: currentWeekId,
            brandId: activeBrandSlug || undefined,
            streamerAssignments: [{ userId }],
            opsUserId: null
        };
    }

    try {
        if (newItem.streamerAssignments.length === 0 && !newItem.opsUserId) {
            await api.deleteScheduleItem(newItem.id);
            setSchedule(schedule.filter(s => s.id !== newItem.id));
        } else {
            await api.saveScheduleItem(newItem);
            const saved = await api.getSchedule(currentWeekId);
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
            id: `${currentWeekId}-${editingSlot.day}-${editingSlot.shiftId}`,
            dayIndex: editingSlot.day,
            shiftId: editingSlot.shiftId,
            weekId: currentWeekId,
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
            const saved = await api.getSchedule(currentWeekId);
            setSchedule(saved);
        }
    } catch(e) { console.error(e); }
  };

  const handleSaveBridge = async () => {
      alert("Tính năng Kẹp ca cần backend logic update phức tạp hơn, đang cập nhật...");
      handleCloseBridgeModal();
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

  const handleOpenUserModal = (u?: User) => {
      setIsEditUser(!!u);
      setOldUserId(u?.id || '');
      setUserFormData(u || { id: '', role: 'STAFF', rank: 'C', password: '123', brandId: activeBrandSlug || undefined });
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
    setShiftFormData(s || { id: '', name: '', startTime: '', endTime: '', color: 'bg-slate-100 text-slate-800 border-slate-200' });
    setIsShiftModalOpen(true);
  };


  // Handle Export (Mock)
  const handleExportExcel = () => { alert("Đang tải xuống báo cáo..."); };
  const handleCloseBridgeModal = () => { setIsBridgeModalOpen(false); setIsSlotModalOpen(true); };
  const handleOpenBridgeModal = (uid: string) => { setBridgeData({...bridgeData, userId: uid}); setIsSlotModalOpen(false); setIsBridgeModalOpen(true); };

  const handleTestBot = async () => {
    setIsTestingBot(true);
    try {
        const result = await ZaloService.testConnection(zaloConfig);
        if (result.success) {
            alert("✅ KẾT NỐI THÀNH CÔNG!\nTin nhắn test đã được gửi đến nhóm Zalo.");
        } else {
            alert(`❌ KẾT NỐI THẤT BẠI!\nChi tiết lỗi: ${result.message}\n\nHãy kiểm tra lại:\n1. URL Webhook có chính xác không?\n2. Biến môi trường ZALO_BOT_TOKEN trên Vercel đã đúng chưa?`);
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
    <div className="min-h-screen flex flex-col md:flex-row dot-grid-bg font-sans pb-20 md:pb-0" style={{color:'#171717'}}>

      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-40" style={{background:'rgba(250,250,250,0.85)',backdropFilter:'blur(16px)',borderBottom:'1px solid #E5E5E5'}}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setIsMobileMenuOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] transition-colors" style={{color:'#737373'}}>
              <Menu size={18} />
            </button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black" style={{background:'#171717'}}>LS</div>
            <span className="text-[15px] font-bold tracking-tight" style={{color:'#171717'}}>LiveSync</span>
          </div>
          <button onClick={() => !currentUser && setIsLoginPageOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors" style={{background:'#F5F5F5',border:'1px solid #E5E5E5'}}>
            {currentUser ? (
              <img src={currentUser.avatar} className="w-5 h-5 rounded-full object-cover" alt="" />
            ) : (
              <span className="text-[12px] font-medium" style={{color:'#737373'}}>Khách</span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.15)',backdropFilter:'blur(2px)'}} onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 bg-white h-full p-5 animate-slide-in" style={{borderRight:'1px solid #E5E5E5',boxShadow:'4px 0 24px rgba(0,0,0,0.08)'}}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black" style={{background:'#171717'}}>LS</div>
                <span className="text-[16px] font-bold tracking-tight" style={{color:'#171717'}}>LiveSync</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5]" style={{color:'#A3A3A3'}}><X size={15}/></button>
            </div>
            <nav className="space-y-0.5">
              <SidebarItem icon={<Calendar size={16}/>} label="Lịch làm việc" active={viewMode === 'DASHBOARD'} onClick={() => { setViewMode('DASHBOARD'); setIsMobileMenuOpen(false); }} />
              {currentUser && (currentUser.role === 'STAFF' || currentUser.role === 'OPERATIONS') && (
                <SidebarItem icon={<Clock size={16}/>} label="Đăng ký rảnh" active={viewMode === 'MY_AVAILABILITY'} onClick={() => { setViewMode('MY_AVAILABILITY'); setIsMobileMenuOpen(false); }} />
              )}
              {currentUser && (
                <SidebarItem icon={<MessageSquare size={16}/>} label="Yêu cầu" active={viewMode === 'REQUESTS'} onClick={() => { setViewMode('REQUESTS'); setIsMobileMenuOpen(false); }} badge={(currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN') && pendingCount > 0 ? pendingCount : undefined}/>
              )}
              {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                <SidebarItem icon={<BarChart3 size={16}/>} label="Báo cáo" active={viewMode === 'REPORTS'} onClick={() => { setViewMode('REPORTS'); setIsMobileMenuOpen(false); }} />
              )}
              {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                <>
                  <div className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Hệ thống</div>
                  <SidebarItem icon={<Users size={16}/>} label="Nhân sự" active={viewMode === 'STAFF_MANAGEMENT'} onClick={() => { setViewMode('STAFF_MANAGEMENT'); setIsMobileMenuOpen(false); }} />
                  <SidebarItem icon={<Settings size={16}/>} label="Cấu hình" active={viewMode === 'SETTINGS'} onClick={() => { setViewMode('SETTINGS'); setIsMobileMenuOpen(false); }} />
                </>
              )}
            </nav>
            <div className="mt-auto absolute bottom-6 left-5 right-5">
              <div className="divider mb-4" />
              {currentUser ? (
                <button onClick={handleLogout} className="sidebar-link" style={{color:'#EF4444'}}>
                  <LogOut size={15}/> {currentUser.role === 'SUPER_ADMIN' ? 'Về Panel Quản Trị' : 'Đăng xuất'}
                </button>
              ) : (
                <button onClick={() => { setIsLoginPageOpen(true); setIsMobileMenuOpen(false); }} className="sidebar-link" style={{color:'#2563EB'}}><LogIn size={15}/> Đăng nhập</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar — minimal strip */}
      <aside className="hidden md:flex w-56 h-screen sticky top-0 flex-col z-30 overflow-y-auto" style={{background:'#FFFFFF',borderRight:'1px solid #E5E5E5'}}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-4" style={{borderBottom:'1px solid #F5F5F5'}}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black" style={{background:'#171717'}}>LS</div>
            <span className="text-[16px] font-bold tracking-tight" style={{color:'#171717'}}>LiveSync</span>
          </div>
        </div>

        {/* User pill */}
        <div className="px-4 py-4">
          {currentUser ? (
            <div className="flex items-center gap-2.5 p-2 rounded-lg" style={{background:'#F5F5F5'}}>
              <img src={currentUser.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{color:'#171717'}}>{currentUser.name}</p>
                <p className="text-[10px]" style={{color:'#A3A3A3'}}>{currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : currentUser.role === 'MANAGER' ? 'Quản lý' : 'Nhân sự'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-2 rounded-lg" style={{background:'#F5F5F5'}}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{background:'#E5E5E5',color:'#A3A3A3'}}><Users size={14}/></div>
              <p className="text-[13px] font-medium" style={{color:'#737373'}}>Khách</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          <SidebarItem icon={<Calendar size={15}/>} label="Lịch làm việc" active={viewMode === 'DASHBOARD'} onClick={() => setViewMode('DASHBOARD')} />
          {currentUser && (currentUser.role === 'STAFF' || currentUser.role === 'OPERATIONS') && (
            <SidebarItem icon={<Clock size={15}/>} label="Đăng ký rảnh" active={viewMode === 'MY_AVAILABILITY'} onClick={() => setViewMode('MY_AVAILABILITY')} />
          )}
          {currentUser && (
            <SidebarItem icon={<MessageSquare size={15}/>} label="Yêu cầu" active={viewMode === 'REQUESTS'} onClick={() => setViewMode('REQUESTS')} badge={(currentUser.role === 'MANAGER' || currentUser.role === 'SUPER_ADMIN') && pendingCount > 0 ? pendingCount : undefined}/>
          )}
          {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
            <SidebarItem icon={<BarChart3 size={15}/>} label="Báo cáo" active={viewMode === 'REPORTS'} onClick={() => setViewMode('REPORTS')} />
          )}
          {(currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
            <>
              <div className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Hệ thống</div>
              <SidebarItem icon={<Users size={15}/>} label="Nhân sự" active={viewMode === 'STAFF_MANAGEMENT'} onClick={() => setViewMode('STAFF_MANAGEMENT')} />
              <SidebarItem icon={<Settings size={15}/>} label="Cấu hình" active={viewMode === 'SETTINGS'} onClick={() => setViewMode('SETTINGS')} />
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="p-3" style={{borderTop:'1px solid #F5F5F5'}}>
          {currentUser ? (
            <button onClick={handleLogout} className="sidebar-link" style={{color:'#EF4444'}}>
              <LogOut size={14}/> {currentUser.role === 'SUPER_ADMIN' ? 'Về Panel Quản Trị' : 'Đăng xuất'}
            </button>
          ) : (
            <button onClick={() => setIsLoginPageOpen(true)} className="sidebar-link" style={{color:'#2563EB'}}><LogIn size={14}/> Đăng nhập</button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full relative">
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
            {viewMode === 'DASHBOARD' && !currentUser && (
              <Button variant="mono" size="sm" onClick={() => setIsLoginPageOpen(true)} icon={<LogIn size={14}/>}>Đăng nhập</Button>
            )}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight mb-0.5" style={{color:'#171717'}}>
              {viewMode === 'DASHBOARD' && 'Lịch làm việc'}
              {viewMode === 'MY_AVAILABILITY' && 'Đăng ký lịch rảnh'}
              {viewMode === 'REQUESTS' && 'Yêu cầu'}
              {viewMode === 'STAFF_MANAGEMENT' && 'Nhân sự'}
              {viewMode === 'SETTINGS' && 'Cấu hình'}
              {viewMode === 'REPORTS' && 'Báo cáo'}
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
                  <span className="text-[22px] font-black tabular-nums leading-none"
                    style={{color: totalShifts > 0 ? '#2563EB' : '#D4D4D4'}}>{totalShifts}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
                    style={{color: totalShifts > 0 ? '#93C5FD' : '#D4D4D4'}}>ca</span>
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-tight" style={{color:'#171717'}}>
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
                            <span className="text-[14px] font-black tabular-nums leading-none"
                              style={{color: todaySlot ? '#2563EB' : '#171717'}}>
                              {date?.getDate()}
                            </span>
                          </div>
                          {/* Divider */}
                          <div className="w-px self-stretch" style={{background:'#E5E5E5'}}/>
                          {/* Shift */}
                          <div>
                            <p className="text-[11px] font-bold leading-tight" style={{color:'#171717'}}>{sh?.name}</p>
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
                      <span className="text-[17px] font-bold tabular-nums leading-none">{date.getDate()}</span>
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
                {shifts.map(shift => {
                  const slot = currentWeekSchedule.find(s => s.dayIndex === selectedDayIndex && s.shiftId === shift.id);
                  const ops = users.find(u => u.id === slot?.opsUserId);
                  const isMyShift = slot?.streamerAssignments.some(sa => sa.userId === currentUser?.id) || slot?.opsUserId === currentUser?.id;
                  return (
                    <div
                      key={shift.id}
                      onClick={() => {
                        checkAuth(() => {
                          if (currentUser?.role === 'MANAGER') {
                            setEditingSlot({ day: selectedDayIndex, shiftId: shift.id });
                            setIsSlotModalOpen(true);
                          } else if (isMyShift) {
                            setRequestForm({ type: 'SWAP', reason: '', slot: { day: selectedDayIndex, shiftId: shift.id } });
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
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold w-fit mb-1 ${shift.color}`}>{shift.startTime}–{shift.endTime}</span>
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
                                return (
                                  <div key={i} className="flex items-center gap-1">
                                    <img src={u?.avatar} className="w-5 h-5 rounded-full object-cover" alt=""/>
                                    <span className="text-[11px] font-medium" style={{color:'#171717'}}>{u?.name}</span>
                                    {sa.timeLabel && <span className="text-[9px] px-1 rounded" style={{background:'#EFF6FF',color:'#2563EB'}}>{sa.timeLabel}</span>}
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
                                <span className={`text-[15px] font-bold tabular-nums leading-none ${today ? 'w-7 h-7 rounded-full flex items-center justify-center text-white' : ''}`}
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
                      {shifts.map((shift, sIdx) => (
                        <tr key={shift.id} style={{borderTop: sIdx > 0 ? '1px solid #F5F5F5' : 'none'}}>
                          {/* Shift label — sticky */}
                          <td className="sticky left-0 z-10 border-r align-middle" style={{background:'#FFFFFF',borderColor:'#F0F0F0',padding:'10px 14px',minHeight:80}}>
                            <p className="text-[12px] font-semibold leading-tight" style={{color:'#171717'}}>{shift.name}</p>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold mt-1 ${shift.color}`}>{shift.startTime}–{shift.endTime}</span>
                          </td>
                          {DAYS_OF_WEEK.map((_, dayIdx) => {
                            const slot = currentWeekSchedule.find(s => s.dayIndex === dayIdx && s.shiftId === shift.id);
                            const ops = users.find(u => u.id === slot?.opsUserId);
                            const isMyShift = slot?.streamerAssignments.some(sa => sa.userId === currentUser?.id) || slot?.opsUserId === currentUser?.id;
                            const today = isToday(weekDates[dayIdx]);
                            return (
                              <td key={dayIdx}
                                onClick={() => {
                                  checkAuth(() => {
                                    if (currentUser?.role === 'MANAGER') {
                                      setEditingSlot({ day: dayIdx, shiftId: shift.id });
                                      setIsSlotModalOpen(true);
                                    } else if (isMyShift) {
                                      setRequestForm({ type: 'SWAP', reason: '', slot: { day: dayIdx, shiftId: shift.id } });
                                      setIsRequestModalOpen(true);
                                    }
                                  });
                                }}
                                className="align-top cursor-pointer group transition-colors"
                                style={{padding: 6, verticalAlign:'top', background: today ? '#F8FBFF' : 'transparent'}}
                              >
                                <div
                                  className="rounded-lg transition-all h-full"
                                  style={{
                                    minHeight: 76,
                                    padding: 8,
                                    background: slot ? (isMyShift ? '#F0F6FF' : '#FAFAFA') : 'transparent',
                                    border: slot ? `1px solid ${isMyShift ? '#BFDBFE' : '#F0F0F0'}` : '1.5px dashed #EBEBEB',
                                    boxShadow: isMyShift ? '0 0 0 2px rgba(37,99,235,0.08)' : 'none',
                                  }}
                                >
                                  {!slot ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{color:'#D4D4D4',minHeight:60}}>
                                      <Plus size={12} strokeWidth={2}/>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
                                      {slot.streamerAssignments.map((sa, i) => {
                                        const u = users.find(user => user.id === sa.userId);
                                        return (
                                          <div key={i} className="flex items-center gap-1.5">
                                            <img src={u?.avatar} className="w-5 h-5 rounded-full object-cover flex-shrink-0" alt=""/>
                                            <div className="min-w-0">
                                              <p className="text-[10px] font-semibold truncate leading-tight" style={{color:'#171717'}}>{u?.name}</p>
                                              {sa.timeLabel && <p className="text-[8px] font-medium" style={{color:'#2563EB'}}>{sa.timeLabel}</p>}
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
                <h3 className="font-bold flex items-center gap-2 text-[15px]" style={{color:'#171717'}}>
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
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold" style={{background:'#F0FDF4',border:'1px solid #BBF7D0',color:'#16A34A'}}>
                    <Check size={13} strokeWidth={3}/> Đã gửi
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitAvailability}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-all hover:opacity-90 active:scale-95"
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
                      <span className="text-[18px] font-bold tabular-nums leading-none">{date.getDate()}</span>
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
                {shifts.map(shift => {
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
                        <p className="text-[14px] font-bold leading-tight" style={{color: isAvailable ? '#1D4ED8' : '#171717'}}>{shift.name}</p>
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
                  className="w-full mt-4 py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
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
                              <span className={`text-[14px] font-bold tabular-nums leading-none${today ? ' w-6 h-6 rounded-full flex items-center justify-center text-white' : ''}`}
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
                    {shifts.map((shift, sIdx) => (
                      <tr key={shift.id} style={{borderTop: sIdx > 0 ? '1px solid #F5F5F5' : 'none'}}>
                        <td className="sticky left-0 z-10 border-r" style={{background:'#FFFFFF',borderColor:'#F0F0F0',padding:'10px 14px'}}>
                          <p className="text-[12px] font-semibold leading-tight" style={{color:'#171717'}}>{shift.name}</p>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold mt-1 ${shift.color}`}>{shift.startTime}–{shift.endTime}</span>
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
          const visibleRequests = currentUser.role === 'MANAGER'
            ? requests
            : requests.filter(r => r.userId === currentUser.id);

          const pendingVisible = visibleRequests.filter(r => r.status === 'PENDING').length;

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold flex items-center gap-2" style={{color:'#171717'}}>
                    <MessageSquare size={15} style={{color:'#737373'}}/>
                    {currentUser.role === 'MANAGER' ? 'Tất cả yêu cầu' : 'Yêu cầu của tôi'}
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>
                    {currentUser.role === 'MANAGER'
                      ? `${visibleRequests.length} yêu cầu${pendingVisible > 0 ? ` · ${pendingVisible} chờ duyệt` : ''}`
                      : `${visibleRequests.length} yêu cầu đã gửi`}
                  </p>
                </div>
                {/* Staff: new request button */}
                {currentUser.role !== 'MANAGER' && (
                  <button
                    onClick={() => { setRequestForm({ type: 'LEAVE', reason: '', slot: undefined }); setIsRequestModalOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-all hover:opacity-90"
                    style={{background:'#171717', color:'#fff'}}
                  >
                    <Plus size={13}/> Tạo yêu cầu
                  </button>
                )}
              </div>

              {visibleRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed text-center"
                  style={{borderColor:'#E5E5E5', background:'#FAFAFA'}}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{background:'#F5F5F5'}}>
                    <MessageSquare size={20} style={{color:'#D4D4D4'}}/>
                  </div>
                  <p className="text-[14px] font-semibold" style={{color:'#171717'}}>
                    {currentUser.role === 'MANAGER' ? 'Chưa có yêu cầu nào' : 'Bạn chưa gửi yêu cầu nào'}
                  </p>
                  <p className="text-[12px] mt-1" style={{color:'#A3A3A3'}}>
                    {currentUser.role === 'MANAGER'
                      ? 'Các yêu cầu xin nghỉ hoặc đổi ca sẽ xuất hiện tại đây.'
                      : 'Nhấn "Tạo yêu cầu" để gửi yêu cầu xin nghỉ hoặc đổi ca.'}
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
                              <p className="text-[13px] font-bold leading-tight" style={{color:'#171717'}}>
                                {isMyRequest && currentUser.role !== 'MANAGER' ? 'Tôi' : req.userName}
                              </p>
                              <p className="text-[10px]" style={{color:'#A3A3A3'}}>
                                {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              req.type === 'LEAVE'
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            }`}>
                              {req.type === 'LEAVE' ? 'Xin nghỉ' : 'Đổi ca'}
                            </span>
                            <span className="text-[11px]" style={{color:'#A3A3A3'}}>·</span>
                            <span className="text-[11px] font-medium" style={{color:'#737373'}}>{DAYS_OF_WEEK[req.dayIndex]}</span>
                            <span className="text-[11px]" style={{color:'#A3A3A3'}}>·</span>
                            <span className="text-[11px] font-bold" style={{color:'#171717'}}>{shift?.name}</span>
                          </div>
                          {req.type === 'SWAP' && req.targetUserName && (
                            <div className="text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1.5"
                              style={{background:'#F5F5F5', color:'#737373'}}>
                              <ArrowRightLeft size={11}/>
                              <span>Đổi với: <span className="font-bold" style={{color:'#171717'}}>{req.targetUserName}</span></span>
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
                        {currentUser.role === 'MANAGER' && isPending && (
                          <div className="flex gap-2 pt-1 pl-2">
                            <button
                              onClick={() => handleProcessRequest(req.id, 'REJECTED')}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:bg-slate-100"
                              style={{border:'1px solid #E5E5E5', color:'#737373'}}
                            >Từ chối</button>
                            <button
                              onClick={() => handleProcessRequest(req.id, 'APPROVED')}
                              className="flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all hover:opacity-90"
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

        {viewMode === 'STAFF_MANAGEMENT' && currentUser && (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#E5E5E5'}}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{background:'#FAFAFA',borderBottom:'1px solid #F0F0F0'}}>
                    <th className="p-4 text-left text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Nhân sự</th>
                    <th className="p-4 text-left text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Vai trò & Rank</th>
                    <th className="p-4 text-left text-[10px] font-semibold uppercase tracking-widest hidden sm:table-cell" style={{color:'#A3A3A3'}}>Doanh thu</th>
                    <th className="p-4 text-right text-[10px] font-semibold uppercase tracking-widest" style={{color:'#A3A3A3'}}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr key={u.id} className="group transition-colors" style={{borderTop: idx > 0 ? '1px solid #F5F5F5' : 'none'}}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={u.avatar} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{border:'2px solid #F5F5F5'}} alt=""/>
                          <div className="min-w-0">
                            <p className="font-semibold text-[13.5px] truncate" style={{color:'#171717'}}>{u.name}</p>
                            <p className="text-[11px]" style={{color:'#A3A3A3'}}>{u.zaloPhone || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <RoleBadge role={u.role} />
                          {u.role === 'STAFF' && <RankBadge rank={u.rank} size="sm" />}
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell align-middle">
                        {u.role === 'STAFF' ? (
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold tabular-nums" style={{color:'#171717'}}>{(u.revenue || 0).toLocaleString()}đ</span>
                            <div className="progress-bar w-28 mt-1.5">
                              <div 
                                className="progress-fill"
                                style={{ width: `${Math.min(100, (u.revenue || 0) / 1500000)}%` }}
                              />
                            </div>
                          </div>
                        ) : <span style={{color:'#D4D4D4'}} className="text-[12px]">N/A</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenUserModal(u)}
                            className="p-2 rounded-lg transition-all hover:bg-[#F5F5F5]"
                            style={{color:'#737373'}}
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={15}/>
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 rounded-lg transition-all hover:bg-red-50"
                            style={{color:'#D4D4D4'}}
                            title="Xóa"
                          >
                            <Trash2 size={15}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'SETTINGS' && currentUser?.role === 'MANAGER' && (
          <div className="space-y-6">
            {/* Shifts Management Section */}
            <div className="bg-white rounded-2xl border p-6" style={{borderColor:'#E5E5E5'}}>
               <div className="flex items-center justify-between mb-5">
                 <div>
                    <h3 className="text-[15px] font-bold flex items-center gap-2" style={{color:'#171717',letterSpacing:'-0.02em'}}><Clock size={16} style={{color:'#737373'}}/> Ca Live</h3>
                    <p className="text-[12px] mt-0.5" style={{color:'#A3A3A3'}}>Quản lý các khung giờ livestream.</p>
                 </div>
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
                        {shifts.map(shift => (
                           <tr key={shift.id} className="hover:bg-slate-50/50">
                              <td className="p-4 font-bold">{shift.name}</td>
                              <td className="p-4 font-mono">{shift.startTime} - {shift.endTime}</td>
                              <td className="p-4">
                                 <div className={`px-2 py-1 rounded text-xs font-bold w-fit ${shift.color}`}>Mẫu hiển thị</div>
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

            {/* Zalo/Bot Configuration Section */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
              <div className="mb-6">
                 <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><Bot className="text-blue-600"/> Cấu hình Bot & Webhook</h3>
                 <p className="text-sm text-slate-500 mt-1">Kết nối Bot Telegram/Zalo Bridge để gửi thông báo vào Group.</p>
              </div>
              <div className="space-y-4 max-w-2xl">
                 <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Webhook / API Endpoint</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={zaloConfig.webhookUrl} onChange={e => setZaloConfig({...zaloConfig, webhookUrl: e.target.value})} placeholder="https://api.telegram.org/bot..." />
                    <p className="text-[10px] text-slate-400 font-medium mt-1 ml-1">Nếu dùng Telegram, nhập: https://api.telegram.org/bot[TOKEN]/sendMessage</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Bot Token</label>
                        <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={zaloConfig.botToken} onChange={e => setZaloConfig({...zaloConfig, botToken: e.target.value})} placeholder="Nhập Token Bot..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Group ID (Chat ID)</label>
                        <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={zaloConfig.groupId} onChange={e => setZaloConfig({...zaloConfig, groupId: e.target.value})} placeholder="Nhập ID nhóm (-100...)" />
                    </div>
                 </div>

                 <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <Button onClick={() => { localStorage.setItem('ls_zalo_config', JSON.stringify(zaloConfig)); alert("Đã lưu cấu hình!"); }} icon={<Save size={16}/>}>Lưu cấu hình</Button>
                    <Button variant="secondary" onClick={handleTestBot} icon={isTestingBot ? <Loader2 size={16} className="animate-spin" /> : <Send size={16}/>} disabled={isTestingBot}>
                        {isTestingBot ? 'Đang gửi...' : 'Test Gửi tin'}
                    </Button>
                 </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS (Login, Slot, Request, Shift, User, Bridge) --- */}
      
      {/* Assignment Modal (Manager) */}
      <Modal isOpen={isSlotModalOpen} onClose={() => setIsSlotModalOpen(false)} title="Điều phối nhân sự">
        <div className="space-y-4">
           <div className="flex bg-slate-100 p-1 rounded-lg">
             <button className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${slotTab === 'STREAMER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`} onClick={() => setSlotTab('STREAMER')}>Streamer</button>
             <button className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${slotTab === 'OPS' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`} onClick={() => setSlotTab('OPS')}>Vận hành</button>
          </div>

          <div className="max-h-[300px] md:max-h-[350px] overflow-y-auto space-y-2 pr-1 scrollbar-hide">
             {slotTab === 'STREAMER' ? (
                <div className="space-y-2">
                    {users.filter(u => u.role === 'STAFF').map(u => {
                    const current = currentWeekSchedule.find(s => s.dayIndex === editingSlot?.day && s.shiftId === editingSlot?.shiftId);
                    const assignment = current?.streamerAssignments.find(sa => sa.userId === u.id);
                    return (
                        <div key={u.id} className="flex gap-1.5">
                            <button onClick={() => toggleStreamerInSlot(u.id)} className={`flex-1 flex items-center justify-between p-2 md:p-3 rounded-xl border transition-all ${assignment ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}>
                                <div className="flex items-center gap-2 md:gap-3">
                                    <img src={u.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-sm" alt=""/>
                                    <div className="text-left min-w-0">
                                        <p className="font-bold text-xs md:text-sm leading-none truncate">{u.name}</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <RankBadge rank={u.rank} size="sm" />
                                          {assignment?.timeLabel && <p className="text-[8px] md:text-[9px] font-black uppercase opacity-80">{assignment.timeLabel}</p>}
                                        </div>
                                    </div>
                                </div>
                                {assignment && <CheckCircle2 size={16} strokeWidth={3}/>}
                            </button>
                            <button onClick={() => handleOpenBridgeModal(u.id)} className={`w-10 md:w-12 flex flex-col items-center justify-center rounded-xl border-2 transition-all ${assignment?.timeLabel ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-100 text-slate-300 hover:text-indigo-600 hover:border-indigo-200'}`}>
                                <Layers size={14}/>
                            </button>
                        </div>
                    );
                    })}
                </div>
             ) : (
                <div className="space-y-2">
                  <button onClick={() => setOpsInSlot(null)} className="w-full p-2.5 rounded-xl border-2 border-dashed border-red-100 text-red-500 font-black text-[10px] uppercase hover:bg-red-50 transition-colors">Hủy vận hành</button>
                  {users.filter(u => u.role === 'OPERATIONS').map(u => {
                    const current = currentWeekSchedule.find(s => s.dayIndex === editingSlot?.day && s.shiftId === editingSlot?.shiftId);
                    const isSelected = current?.opsUserId === u.id;
                    return (
                      <button key={u.id} onClick={() => setOpsInSlot(u.id)} className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${isSelected ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-100' : 'bg-slate-50 border-slate-100 hover:border-orange-300'}`}>
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-sm" alt=""/>
                          <p className="font-bold text-xs md:text-sm leading-none">{u.name}</p>
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
                             <p className="font-bold text-sm text-slate-900">{users.find(u => u.id === bridgeData.userId)?.name}</p>
                             <p className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">Đang cấu hình</p>
                         </div>
                    </div>
                </div>
                {/* Simplified content for demo - you can expand this with time pickers as in previous version */}
                <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center">
                    <p className="text-sm text-slate-500">Tính năng chọn giờ kẹp ca (Backend logic)</p>
                </div>
                <div className="flex gap-2 pt-2">
                    <Button variant="secondary" className="flex-1 font-bold" onClick={handleCloseBridgeModal}>Hủy</Button>
                    <Button className="flex-1 font-black shadow-lg shadow-indigo-100" onClick={handleSaveBridge} icon={<Save size={16}/>}>Lưu cấu hình</Button>
                </div>
              </div>
          )}
      </Modal>

      {/* User (Staff) Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={isEditUser ? "Chỉnh sửa nhân sự" : "Thêm nhân sự mới"}>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1">Thông tin cơ bản</label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* ID Field */}
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold"
                    value={userFormData.id || ''} 
                    onChange={e => setUserFormData({...userFormData, id: e.target.value})} 
                    placeholder="Mã nhân sự (ID/Username)..." 
                  />
                  {/* Password Field */}
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold"
                    value={userFormData.password || ''} 
                    onChange={e => setUserFormData({...userFormData, password: e.target.value})} 
                    placeholder="Mật khẩu..." 
                  />
                </div>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={userFormData.name || ''} onChange={e => setUserFormData({...userFormData, name: e.target.value})} placeholder="Họ và tên..." />
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={userFormData.zaloPhone || ''} onChange={e => setUserFormData({...userFormData, zaloPhone: e.target.value})} placeholder="Số Zalo..." />
              </div>
            </div>
            {/* Roles Selection */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Vai trò</label>
              <div className="grid grid-cols-3 gap-2">
                {['STAFF', 'OPERATIONS', 'MANAGER'].map((r) => (
                  <button key={r} onClick={() => setUserFormData({...userFormData, role: r as Role})} className={`p-2 rounded-lg border text-[10px] font-bold ${userFormData.role === r ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{r}</button>
                ))}
              </div>
            </div>
            {/* Rank Selection if Staff */}
            {userFormData.role === 'STAFF' && (
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Rank</label>
                    <div className="grid grid-cols-4 gap-2">
                        {['S', 'A', 'B', 'C'].map((r) => (
                        <button key={r} onClick={() => setUserFormData({...userFormData, rank: r as Rank})} className={`p-2 rounded-lg border text-[10px] font-bold ${userFormData.rank === r ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{r}</button>
                        ))}
                    </div>
                </div>
            )}
            {/* Revenue */}
            {userFormData.role === 'STAFF' && (
                <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" value={userFormData.revenue || 0} onChange={e => setUserFormData({...userFormData, revenue: Number(e.target.value)})} placeholder="Doanh thu..." />
            )}
          </div>

          <div className="pt-4 flex gap-2">
            <Button variant="secondary" className="flex-1 font-bold" onClick={() => setIsUserModalOpen(false)}>Hủy</Button>
            <Button className="flex-1 font-black shadow-lg shadow-indigo-100" onClick={handleSaveUser} icon={<Save size={16}/>}>Lưu nhân sự</Button>
          </div>
        </div>
      </Modal>

      {/* Shift Edit Modal */}
      <Modal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} title={shiftFormData.id ? "Sửa Ca Live" : "Thêm Ca Live Mới"}>
         <div className="space-y-4">
             <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1">Thông tin Ca</label>
                <div className="space-y-3">
                   <div className="grid grid-cols-3 gap-3">
                      <input type="text" disabled={!!shiftFormData.id && shiftFormData.id !== '' && shifts.some(s => s.id === shiftFormData.id)} className="col-span-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold uppercase" value={shiftFormData.id} onChange={e => setShiftFormData({...shiftFormData, id: e.target.value})} placeholder="Mã (VD: ca1)..." />
                      <input type="text" className="col-span-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold" value={shiftFormData.name} onChange={e => setShiftFormData({...shiftFormData, name: e.target.value})} placeholder="Tên ca (VD: Ca Sáng)..." />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold" value={shiftFormData.startTime} onChange={e => setShiftFormData({...shiftFormData, startTime: e.target.value})} />
                      <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold" value={shiftFormData.endTime} onChange={e => setShiftFormData({...shiftFormData, endTime: e.target.value})} />
                   </div>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1">Màu sắc hiển thị</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
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
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Hình thức</label>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setRequestForm({...requestForm, type: 'SWAP'})} className={`p-3 rounded-xl border-2 font-black text-[10px] uppercase ${requestForm.type === 'SWAP' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>Thay đổi nhân sự</button>
                   <button onClick={() => setRequestForm({...requestForm, type: 'LEAVE'})} className={`p-3 rounded-xl border-2 font-black text-[10px] uppercase ${requestForm.type === 'LEAVE' ? 'bg-red-600 text-white' : 'bg-white'}`}>Xin nghỉ ca</button>
                </div>
             </div>
             {requestForm.type === 'SWAP' && (
               <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" value={requestForm.targetUserId || ''} onChange={e => setRequestForm({...requestForm, targetUserId: e.target.value})}>
                    <option value="">-- Chọn đồng nghiệp --</option>
                    {users.filter(u => u.id !== currentUser?.id && u.role === 'STAFF').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
               </select>
             )}
             <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold resize-none" value={requestForm.reason} onChange={e => setRequestForm({...requestForm, reason: e.target.value})} placeholder="Lý do..."></textarea>
          </div>
          <div className="pt-2 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1 font-bold" onClick={() => setIsRequestModalOpen(false)}>Hủy</Button>
            <Button size="sm" className="flex-1 font-black" onClick={createRequest} icon={<Send size={14}/>}>Gửi yêu cầu</Button>
          </div>
        </div>
      </Modal>

    </div>
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
      <span className="w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center" style={{background:'#EF4444'}}>
        {badge}
      </span>
    )}
  </button>
);
