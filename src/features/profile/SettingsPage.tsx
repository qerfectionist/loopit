import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, MapPin, Bell, Shield, HelpCircle, LogOut } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { triggerHaptic } from '@/lib/telegram';

export const SettingsPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: <User size={18} />, label: 'Edit Profile', onClick: () => {} },
        { icon: <MapPin size={18} />, label: 'Location Preferences', onClick: () => {} },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: <Bell size={18} />, label: 'Notifications', onClick: () => {} },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: <HelpCircle size={18} />, label: 'Help & FAQ', onClick: () => {} },
        { icon: <Shield size={18} />, label: 'Privacy & Terms', onClick: () => {} },
      ]
    }
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
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1">
                {section.title}
              </h3>
              <Card padding={false} className="overflow-hidden">
                <div className="flex flex-col">
                  {section.items.map((item, i) => (
                    <button
                      key={item.label}
                      className={`flex items-center gap-3 p-4 text-left hover:bg-bg-tertiary transition-colors ${
                        i !== section.items.length - 1 ? 'border-b border-border' : ''
                      }`}
                      onClick={() => {
                        triggerHaptic('light');
                        item.onClick();
                      }}
                    >
                      <div className="text-text-muted">{item.icon}</div>
                      <span className="text-[15px] font-medium flex-1">{item.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          ))}

          <Button 
            variant="secondary" 
            className="w-full text-error border-error/20 bg-error/5 hover:bg-error/10 mt-4"
            icon={<LogOut size={18} />}
          >
            Log Out
          </Button>
        </div>
      </div>
    </Shell>
  );
};
