import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, MapPin, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, Check, Loader2,
} from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card, Input, Avatar } from '@/components/ui';
import { showAlert, triggerHaptic, triggerNotification } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useUpdateProfile } from '@/hooks/useAuth';

// ─────────────────────────────────────────────────────────────────────────
// Edit Profile inline form
// ─────────────────────────────────────────────────────────────────────────
const EditProfileForm = ({ onClose }: { onClose: () => void }) => {
  const currentUser = useAppStore((s) => s.currentUser);
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

  const [form, setForm] = useState({
    first_name: currentUser?.first_name ?? '',
    last_name: currentUser?.last_name ?? '',
    username: currentUser?.username ?? '',
    bio: currentUser?.bio ?? '',
  });

  const handleSave = async () => {
    if (!currentUser) return;
    triggerHaptic('medium');
    try {
      await updateProfile({ userId: currentUser.id, updates: form });
      triggerNotification('success');
      onClose();
    } catch {
      triggerNotification('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button
          onClick={() => { triggerHaptic('light'); onClose(); }}
          className="p-2 -ml-2 text-text-primary"
        >
          <ArrowLeft size={22} />
        </button>
        <h2 className="flex-1 text-[17px] font-semibold">Edit Profile</h2>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 text-accent font-semibold text-[15px] disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <Avatar
            name={form.first_name}
            lastName={form.last_name}
            size="xl"
          />
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-text-secondary font-medium mb-1.5 block">First Name</label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="First name"
              />
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-text-secondary font-medium mb-1.5 block">Last Name</label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-text-secondary font-medium mb-1.5 block">Username</label>
            <Input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="@username"
            />
          </div>

          <div>
            <label className="text-[12px] text-text-secondary font-medium mb-1.5 block">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell others about yourself..."
              maxLength={200}
              rows={3}
              className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-[15px] text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <p className="text-[11px] text-text-muted text-right mt-1">{form.bio.length}/200</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────
export const SettingsPage = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const [editOpen, setEditOpen] = useState(false);

  const handleLogout = () => {
    triggerHaptic('medium');
    // Clear stored auth
    localStorage.removeItem('loopit_token');
    localStorage.removeItem('loopit_user');
    // Clear app state
    setCurrentUser(null);
    // Go to root — will re-trigger auth
    navigate('/', { replace: true });
  };

  const showComingSoon = (message: string) => {
    triggerHaptic('light');
    void showAlert(message);
  };

  const sections = [
    {
      title: 'Account',
      items: [
        {
          icon: <User size={18} />,
          label: 'Edit Profile',
          sub: `${currentUser?.first_name ?? ''} ${currentUser?.last_name ?? ''}`.trim(),
          onClick: () => { triggerHaptic('light'); setEditOpen(true); },
        },
        {
          icon: <MapPin size={18} />,
          label: 'Location',
          sub: 'Set your area',
          onClick: () => showComingSoon('Location settings are not available yet.'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: <Bell size={18} />,
          label: 'Notifications',
          sub: 'Match alerts, messages',
          onClick: () => showComingSoon('Notification settings are not available yet.'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: <HelpCircle size={18} />,
          label: 'Help & FAQ',
          sub: 'How Loopit works',
          onClick: () => showComingSoon('Help & FAQ is not available yet.'),
        },
        {
          icon: <Shield size={18} />,
          label: 'Privacy & Terms',
          onClick: () => showComingSoon('Privacy & Terms is not available yet.'),
        },
      ],
    },
  ];

  return (
    <Shell hideNav>
      <PageHeader title="Settings" />
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 p-2 -ml-2 text-text-primary z-20"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="px-5 pb-6 pt-16">
        {/* Profile preview card */}
        {currentUser && (
          <button
            onClick={() => { triggerHaptic('light'); setEditOpen(true); }}
            className="w-full flex items-center gap-4 p-4 bg-bg-secondary rounded-2xl border border-border mb-6 text-left hover:bg-bg-tertiary active:scale-[0.99] transition-all"
          >
            <Avatar name={currentUser.first_name} lastName={currentUser.last_name ?? undefined} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold truncate">
                {currentUser.first_name} {currentUser.last_name ?? ''}
              </p>
              {currentUser.username && (
                <p className="text-[13px] text-text-secondary">@{currentUser.username}</p>
              )}
              {currentUser.bio && (
                <p className="text-[12px] text-text-muted mt-0.5 truncate">{currentUser.bio}</p>
              )}
            </div>
            <ChevronRight size={18} className="text-text-muted flex-shrink-0" />
          </button>
        )}

        <div className="flex flex-col gap-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1">
                {section.title}
              </h3>
              <Card padding={false} className="overflow-hidden">
                <div className="flex flex-col">
                  {section.items.map((item, i) => (
                    <button
                      key={item.label}
                      className={`flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg-tertiary active:bg-bg-hover transition-colors ${
                        i !== section.items.length - 1 ? 'border-b border-border' : ''
                      }`}
                      onClick={item.onClick}
                    >
                      <div className="w-8 h-8 bg-bg-tertiary rounded-lg flex items-center justify-center text-text-secondary flex-shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium">{item.label}</p>
                        {'sub' in item && item.sub && (
                          <p className="text-[12px] text-text-muted truncate">{item.sub}</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          ))}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-error/5 border border-error/20 rounded-2xl text-error hover:bg-error/10 active:bg-error/15 transition-colors"
          >
            <div className="w-8 h-8 bg-error/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <LogOut size={18} />
            </div>
            <span className="text-[15px] font-semibold flex-1 text-left">Log Out</span>
          </button>

          {/* Version */}
          <p className="text-center text-[12px] text-text-muted mt-2">
            Loopit v0.1.0 · Made with ❤️
          </p>
        </div>
      </div>

      {/* Edit Profile overlay */}
      {editOpen && <EditProfileForm onClose={() => setEditOpen(false)} />}
    </Shell>
  );
};
