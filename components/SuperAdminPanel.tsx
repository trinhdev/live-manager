import React, { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, ExternalLink, Users, Calendar,
  ShieldCheck, LogOut, Building2, X, Check, Loader2,
  TrendingUp, Globe, ChevronRight, AlertTriangle, LayoutGrid
} from 'lucide-react';
import { Brand, User } from '../types';
import { api } from '../services/api';

// ─── Brand Form Modal ─────────────────────────────────────────
interface BrandModalProps {
  brand?: Brand | null;
  onSave: (brand: Brand) => Promise<Brand | void>;
  onClose: () => void;
}

const BRAND_COLORS = [
  '#2563EB', '#7C3AED', '#DC2626', '#059669', '#D97706',
  '#0891B2', '#BE185D', '#65A30D', '#EA580C', '#171717',
];

function BrandModal({ brand, onSave, onClose }: BrandModalProps) {
  const isEdit = !!brand;
  const [form, setForm] = useState<Brand>({
    id: brand?.id || '',
    name: brand?.name || '',
    logoUrl: brand?.logoUrl || '',
    color: brand?.color || '#2563EB',
    active: brand?.active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.id.trim()) return setError('Slug (ID) không được để trống');
    if (!form.name.trim()) return setError('Tên brand không được để trống');
    if (!/^[a-z0-9-]+$/.test(form.id)) return setError('Slug chỉ gồm chữ thường, số và dấu gạch ngang');
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu brand');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.9)' }}>
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>{isEdit ? 'Chỉnh sửa Brand' : 'Thêm Brand mới'}</h2>
            <p className="text-[12px] mt-0.5" style={{ color: '#A3A3A3' }}>{isEdit ? `Đang sửa /${brand?.id}` : 'Tạo workspace mới cho một brand'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-black/5">
            <X size={15} style={{ color: '#737373' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Slug */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>Slug / ID</label>
            <div className="flex items-center gap-0 rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)' }}>
              <span className="px-3 py-2.5 text-[13px] font-mono" style={{ background: 'rgba(0,0,0,0.04)', color: '#A3A3A3', borderRight: '1px solid rgba(0,0,0,0.08)' }}>livesync.app/</span>
              <input
                value={form.id}
                onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                disabled={isEdit}
                placeholder="gimmetee"
                className="flex-1 px-3 py-2.5 text-[13px] font-mono outline-none disabled:opacity-50"
                style={{ background: 'transparent', color: '#1A1A1A' }}
              />
            </div>
            {isEdit && <p className="text-[10px] mt-1" style={{ color: '#F59E0B' }}>⚠ Slug không thể đổi sau khi tạo</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>Tên Brand</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Gimmetee Fashion"
              className="w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none"
              style={{ borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)', color: '#1A1A1A' }}
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>Logo URL <span style={{ color: '#D4D4D4' }}>(tùy chọn)</span></label>
            <input
              value={form.logoUrl || ''}
              onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none font-mono"
              style={{ borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)', color: '#1A1A1A' }}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#737373' }}>Màu Brand</label>
            <div className="flex items-center gap-2 flex-wrap">
              {BRAND_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full transition-all flex items-center justify-center"
                  style={{ background: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }}
                >
                  {form.color === c && <Check size={13} color="#fff" strokeWidth={3} />}
                </button>
              ))}
              <label className="relative cursor-pointer">
                <div className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: '#D4D4D4' }}>
                  <Plus size={12} style={{ color: '#A3A3A3' }} />
                </div>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              </label>
              <div className="ml-2 px-2 py-1 rounded-lg text-[11px] font-mono" style={{ background: 'rgba(0,0,0,0.05)', color: '#737373' }}>{form.color}</div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              <AlertTriangle size={13} />{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-[13px] font-medium transition-colors hover:bg-black/5" style={{ borderColor: 'rgba(0,0,0,0.1)', color: '#737373' }}>Hủy</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
            style={{ background: form.color || '#4F46E5', color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? 'Lưu thay đổi' : 'Tạo Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────
function DeleteConfirm({ brand, onConfirm, onCancel }: { brand: Brand; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.9)' }}>
        <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#FEF2F2' }}>
          <Trash2 size={20} style={{ color: '#DC2626' }} />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight mb-1" style={{ color: '#1A1A1A' }}>Xóa brand "{brand.name}"?</h3>
        <p className="text-[12px] mb-5" style={{ color: '#737373' }}>Toàn bộ nhân sự, ca làm việc, lịch và yêu cầu của brand này sẽ bị xóa vĩnh viễn.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-[13px] font-medium hover:bg-black/5 transition-colors" style={{ borderColor: 'rgba(0,0,0,0.1)', color: '#737373' }}>Hủy</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold" style={{ background: '#DC2626', color: '#fff' }}>Xóa Brand</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main SuperAdminPanel ─────────────────────────────────────
interface SuperAdminPanelProps {
  currentUser: User;
  onNavigateToBrand: (slug: string) => void;
  onLogout: () => void;
}

export function SuperAdminPanel({ currentUser, onNavigateToBrand, onLogout }: SuperAdminPanelProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [deleteBrand, setDeleteBrand] = useState<Brand | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [b, allUsers] = await Promise.all([
        api.getBrands(),
        api.getUsers(),
      ]);
      setBrands(b);
      const counts: Record<string, number> = {};
      allUsers.forEach(u => { if (u.brandId) counts[u.brandId] = (counts[u.brandId] || 0) + 1; });
      setUserCounts(counts);
    } catch (e) {
      console.error('Failed to load brands:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaveBrand = async (brand: Brand) => {
    const saved = await api.saveBrand(brand);
    await load();
    return saved;
  };

  const handleDeleteBrand = async () => {
    if (!deleteBrand) return;
    await api.deleteBrand(deleteBrand.id);
    setDeleteBrand(null);
    await load();
  };

  const stats = [
    { label: 'Tổng Brands', value: brands.length, icon: <Building2 size={16} />, color: '#4F46E5' },
    { label: 'Tổng Nhân sự', value: Object.values(userCounts).reduce((a, b) => a + b, 0), icon: <Users size={16} />, color: '#0891B2' },
    { label: 'Brands Active', value: brands.filter(b => b.active !== false).length, icon: <TrendingUp size={16} />, color: '#059669' },
    { label: 'Hệ thống', value: 'Online', icon: <Globe size={16} />, color: '#D97706' },
  ];

  return (
    <div className="min-h-screen relative" style={{ fontFamily: "'Inter', sans-serif", background: '#F3F4F6' }}>
      {/* Aurora mesh background */}
      <div className="aurora-mesh">
        <div className="blob-1" />
        <div className="blob-2" />
        <div className="blob-3" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col md:flex-row">
        {/* ── Sidebar ── */}
        <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col z-30 overflow-y-auto"
          style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255,255,255,0.8)' }}>
          {/* Logo */}
          <div className="px-6 pt-10 pb-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-semibold" style={{ background: '#4F46E5' }}>LS</div>
              <div>
                <span className="text-[16px] font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>LiveSync</span>
                <div className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: '#A3A3A3' }}>Super Admin</div>
              </div>
            </div>
          </div>

          {/* User pill */}
          <div className="px-5 py-5">
            <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[13px] font-semibold" style={{ background: '#4F46E5' }}>
                {currentUser.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: '#262626' }}>{currentUser.name}</p>
                <p className="text-[11px] font-light" style={{ color: '#A3A3A3' }}>System Admin</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-4 py-2 space-y-1">
            <button className="sidebar-link active w-full">
              <span className="sidebar-icon"><LayoutGrid size={18} /></span>
              <span>Brands</span>
            </button>
          </nav>

          {/* Bottom */}
          <div className="p-5 mt-auto" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <button onClick={onLogout} className="flex items-center gap-2 text-red-400 font-medium text-[13px] px-2 py-2 w-full rounded-xl hover:bg-red-50 transition-colors">
              <LogOut size={15} strokeWidth={1.5} /> Đăng xuất
            </button>
          </div>
        </aside>

        {/* ── Mobile top bar ── */}
        <header className="md:hidden sticky top-0 z-40 px-5 pt-10 pb-4" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>LiveSync</h1>
              <p className="text-[11px] font-light mt-0.5" style={{ color: '#A3A3A3' }}>Super Admin · {currentUser.name}</p>
            </div>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.5)', color: '#737373' }}>
              <LogOut size={13} /> Thoát
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* Page title */}
          <div className="mb-6">
            <h2 className="text-[22px] font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>Quản lý Brands</h2>
            <p className="text-[13px] mt-0.5" style={{ color: '#737373' }}>Tất cả workspace trong hệ thống LiveSync</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18`, color: s.color }}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-[18px] font-semibold leading-none tabular-nums tracking-tight" style={{ color: '#1A1A1A' }}>{s.value}</p>
                  <p className="text-[11px] mt-0.5 font-light" style={{ color: '#A3A3A3' }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Brands section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[13px] font-medium" style={{ color: '#737373' }}>{brands.length} brands</p>
            </div>
            <button
              onClick={() => { setEditBrand(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#4F46E5', color: '#fff', boxShadow: '0 4px 16px rgba(79,70,229,0.25)' }}
            >
              <Plus size={15} /> Thêm Brand
            </button>
          </div>

          {/* Brand grid */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin" style={{ color: '#A3A3A3' }} />
            </div>
          ) : brands.length === 0 ? (
            <div className="flex flex-col items-center py-20 rounded-3xl border border-dashed text-center" style={{ borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.4)' }}>
              <Building2 size={32} style={{ color: '#D4D4D4', marginBottom: 12 }} />
              <p className="text-[14px] font-semibold" style={{ color: '#1A1A1A' }}>Chưa có brand nào</p>
              <p className="text-[12px] mt-1 mb-4" style={{ color: '#A3A3A3' }}>Thêm brand đầu tiên để bắt đầu</p>
              <button onClick={() => { setEditBrand(null); setModalOpen(true); }} className="px-4 py-2 rounded-xl text-[13px] font-semibold" style={{ background: '#4F46E5', color: '#fff' }}>
                <Plus size={14} className="inline mr-1.5" />Thêm Brand
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {brands.map(brand => {
                const count = userCounts[brand.id] || 0;
                const color = brand.color || '#4F46E5';
                return (
                  <div key={brand.id}
                    className="rounded-3xl overflow-hidden transition-all hover:shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    {/* Color strip */}
                    <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }} />

                    <div className="p-5">
                      {/* Brand header */}
                      <div className="flex items-start gap-3 mb-4">
                        {brand.logoUrl ? (
                          <img src={brand.logoUrl} alt={brand.name} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" style={{ border: '1px solid rgba(0,0,0,0.06)' }} />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-[15px] font-semibold" style={{ background: `${color}18`, color }}>
                            {brand.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold leading-tight truncate tracking-tight" style={{ color: '#1A1A1A' }}>{brand.name}</p>
                          <code className="text-[11px] px-1.5 py-0.5 rounded-lg mt-0.5 inline-block" style={{ background: 'rgba(0,0,0,0.05)', color: '#737373' }}>/{brand.id}</code>
                        </div>
                        {brand.active === false && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0" style={{ background: '#FEF3C7', color: '#D97706' }}>Tắt</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div className="flex items-center gap-1.5">
                          <Users size={13} style={{ color: '#A3A3A3' }} />
                          <span className="text-[12px] font-medium" style={{ color: '#737373' }}>{count} nhân sự</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} style={{ color: '#A3A3A3' }} />
                          <span className="text-[12px] font-medium" style={{ color: '#737373' }}>Active</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onNavigateToBrand(brand.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90 active:scale-95"
                          style={{ background: color, color: '#fff', boxShadow: `0 3px 12px ${color}35` }}
                        >
                          <ExternalLink size={13} /> Quản lý
                          <ChevronRight size={13} />
                        </button>
                        <button
                          onClick={() => { setEditBrand(brand); setModalOpen(true); }}
                          className="p-2 rounded-xl transition-all hover:bg-black/5"
                          style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                          title="Sửa brand"
                        >
                          <Pencil size={13} style={{ color: '#737373' }} />
                        </button>
                        <button
                          onClick={() => setDeleteBrand(brand)}
                          className="p-2 rounded-xl transition-all hover:bg-red-50"
                          style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                          title="Xóa brand"
                        >
                          <Trash2 size={13} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {modalOpen && (
        <BrandModal
          brand={editBrand}
          onSave={handleSaveBrand}
          onClose={() => { setModalOpen(false); setEditBrand(null); }}
        />
      )}
      {deleteBrand && (
        <DeleteConfirm
          brand={deleteBrand}
          onConfirm={handleDeleteBrand}
          onCancel={() => setDeleteBrand(null)}
        />
      )}
    </div>
  );
}
