
import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { Button } from './Button';
import { User as UserIcon, Lock, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
  users: User[];           // brand users (empty for super admin login)
  loading?: boolean;
  onBack: () => void;
  brandSlug?: string;      // set when logging into a brand (e.g. 'gimmetee')
  isSuperAdminLogin?: boolean; // true when at root /
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
        // For super admin, query DB directly (no brand filter)
        const allUsers = await api.getUsers();
        const user = allUsers.find(u => u.id === username && u.password === password && u.role === 'SUPER_ADMIN');
        if (user) {
          onLogin(user);
        } else {
          setError('ID hoặc mật khẩu Super Admin không đúng');
        }
      } else {
        // Brand user login — check local brand users list first
        let user = users.find(u => u.id === username && u.password === password);
        if (!user && brandSlug) {
          // Fallback: query DB directly with brand filter
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

  return (
    <div className="min-h-screen dot-grid-bg flex items-center justify-center p-4 relative">
      {/* Soft ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#171717]/4 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        {/* Card */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          {/* Logo + Brand context */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[13px] font-black flex-shrink-0"
              style={{ background: '#171717' }}
            >
              LS
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#171717] tracking-tight leading-tight">LiveSync</p>
              {isSuperAdminLogin ? (
                <p className="text-[11px] text-[#737373] flex items-center gap-1">
                  <ShieldCheck size={10} /> Cổng Super Admin
                </p>
              ) : brandSlug ? (
                <p className="text-[11px] font-mono" style={{ color: '#2563EB' }}>/{brandSlug}</p>
              ) : (
                <p className="text-[11px] text-[#737373]">Quản lý mẫu live</p>
              )}
            </div>
          </div>

          <h1 className="text-[22px] font-bold text-[#171717] tracking-tight mb-1">
            {isSuperAdminLogin ? 'Super Admin' : 'Đăng nhập'}
          </h1>
          <p className="text-[13px] text-[#737373] mb-7">
            {isSuperAdminLogin
              ? 'Đăng nhập để quản lý toàn bộ hệ thống.'
              : 'Nhập thông tin tài khoản để tiếp tục.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3]">
                {isSuperAdminLogin ? 'Admin ID' : 'ID Nhân sự'}
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]">
                  {isSuperAdminLogin ? <ShieldCheck size={15} strokeWidth={2} /> : <UserIcon size={15} strokeWidth={2} />}
                </div>
                <input
                  type="text"
                  className="input-minimal pl-9"
                  placeholder={isSuperAdminLogin ? 'superadmin' : 'Ví dụ: u1'}
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3]">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]">
                  <Lock size={15} strokeWidth={2} />
                </div>
                <input
                  type="password"
                  className="input-minimal pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[12px] font-medium">
                <AlertCircle size={14} strokeWidth={2} />
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="mono"
              className="w-full h-10 text-[13.5px] mt-1 rounded-lg"
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="animate-spin" size={16} /> : 'Đăng nhập'}
            </Button>
          </form>
        </div>

        {brandSlug && (
          <p className="text-center text-[11px] text-[#A3A3A3] mt-6">
            Quên mật khẩu?{' '}
            <span className="text-[#2563EB] cursor-pointer hover:underline font-medium">
              Liên hệ quản lý
            </span>
          </p>
        )}

        {isSuperAdminLogin && (
          <p className="text-center text-[11px] text-[#A3A3A3] mt-6">
            LiveSync v2.0 · Multi-Brand Edition
          </p>
        )}
      </div>
    </div>
  );
};
