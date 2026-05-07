
import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { User as UserIcon, Lock, AlertCircle, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
  users: User[];
  loading?: boolean;
  onBack: () => void;
  brandSlug?: string;
  isSuperAdminLogin?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin, users, loading, onBack, brandSlug, isSuperAdminLogin
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isSuperAdminLogin) {
        const allUsers = await api.getUsers();
        const user = allUsers.find(u => u.id === username && u.password === password && u.role === 'SUPER_ADMIN');
        if (user) {
          onLogin(user);
        } else {
          setError('ID hoặc mật khẩu Super Admin không đúng');
        }
      } else {
        let user = users.find(u => u.id === username && u.password === password);
        if (!user && brandSlug) {
          const brandUsers = await api.getUsers(brandSlug);
          user = brandUsers.find(u => u.id === username && u.password === password);
        }
        if (user) {
          onLogin(user);
        } else {
          setError('ID hoặc mật khẩu không đúng');
        }
      }
    } catch (err) {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = loading || submitting;
  const accentColor = isSuperAdminLogin ? '#4F46E5' : (brandSlug ? '#4F46E5' : '#4F46E5');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#F3F4F6', fontFamily: "'Inter', sans-serif" }}>

      {/* Aurora mesh blobs */}
      <div className="aurora-mesh">
        <div className="blob-1" />
        <div className="blob-2" />
        <div className="blob-3" />
      </div>

      {/* Extra ambient orbs for login page depth */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C7D2FE 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-60 h-60 rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FBCFE8 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Glass card */}
        <div className="rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.9)',
          }}>

          {/* Logo header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0 shadow-md"
              style={{ background: accentColor, boxShadow: `0 4px 16px ${accentColor}40` }}>
              LS
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>LiveSync</p>
              {isSuperAdminLogin ? (
                <p className="text-[11px] flex items-center gap-1 font-medium" style={{ color: accentColor }}>
                  <ShieldCheck size={10} /> Cổng Super Admin
                </p>
              ) : brandSlug ? (
                <p className="text-[11px] font-mono font-medium" style={{ color: accentColor }}>/{brandSlug}</p>
              ) : (
                <p className="text-[11px] font-light" style={{ color: '#A3A3A3' }}>Quản lý mẫu live</p>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="mb-7">
            <h1 className="text-[24px] font-semibold tracking-tight mb-1" style={{ color: '#1A1A1A' }}>
              {isSuperAdminLogin ? 'Super Admin' : 'Đăng nhập'}
            </h1>
            <p className="text-[13px] font-light" style={{ color: '#737373' }}>
              {isSuperAdminLogin
                ? 'Đăng nhập để quản lý toàn bộ hệ thống.'
                : 'Nhập thông tin tài khoản để tiếp tục.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#A3A3A3' }}>
                {isSuperAdminLogin ? 'Admin ID' : 'ID Nhân sự'}
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#A3A3A3' }}>
                  {isSuperAdminLogin ? <ShieldCheck size={15} strokeWidth={1.8} /> : <UserIcon size={15} strokeWidth={1.8} />}
                </div>
                <input
                  type="text"
                  placeholder={isSuperAdminLogin ? 'superadmin' : 'Ví dụ: u1'}
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-[13.5px] font-medium outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    color: '#1A1A1A',
                  }}
                  onFocus={e => { e.currentTarget.style.border = `1px solid ${accentColor}`; e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}18`; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.6)'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#A3A3A3' }}>
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#A3A3A3' }}>
                  <Lock size={15} strokeWidth={1.8} />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-[13.5px] font-medium outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    color: '#1A1A1A',
                  }}
                  onFocus={e => { e.currentTarget.style.border = `1px solid ${accentColor}`; e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}18`; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.6)'; }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-[12px] font-medium"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                <AlertCircle size={14} strokeWidth={2} />
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-3 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] mt-1"
              style={{
                background: accentColor,
                color: '#fff',
                opacity: isBusy ? 0.7 : 1,
                boxShadow: `0 4px 20px ${accentColor}35`,
              }}
            >
              {isBusy
                ? <Loader2 className="animate-spin" size={16} />
                : <>
                    {isSuperAdminLogin && <Sparkles size={14} />}
                    Đăng nhập
                  </>
              }
            </button>
          </form>
        </div>

        {/* Footer text */}
        <p className="text-center text-[11px] mt-5 font-light" style={{ color: '#A3A3A3' }}>
          {isSuperAdminLogin
            ? 'LiveSync v2.0 · Multi-Brand Edition'
            : brandSlug
              ? <>Quên mật khẩu? <span className="font-medium cursor-pointer hover:underline" style={{ color: accentColor }}>Liên hệ quản lý</span></>
              : 'LiveSync · Hệ thống quản lý livestream'}
        </p>
      </div>
    </div>
  );
};
