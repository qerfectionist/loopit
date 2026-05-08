import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Star, Settings, ChevronRight, Heart, ArrowUpRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Shell } from '@/components/layout';
import { Avatar, Card, Button } from '@/components/ui';
import { triggerHaptic } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useUserItems } from '@/hooks/useItems';
import { useWishlist } from '@/hooks/useWishlist';
import { useExchanges } from '@/hooks/useExchanges';
import { useAuth } from '@/hooks/useAuth';

const MenuItem = ({ icon: Icon, label, value, onClick }: {
  icon: React.ElementType;
  label: string;
  value?: string;
  onClick?: () => void;
}) => (
  <button
    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg-tertiary active:bg-bg-hover transition-colors"
    onClick={() => { triggerHaptic('light'); onClick?.(); }}
  >
    <div className="w-9 h-9 bg-bg-tertiary rounded-xl flex items-center justify-center flex-shrink-0">
      <Icon size={18} className="text-text-secondary" />
    </div>
    <span className="flex-1 text-[14px] text-left">{label}</span>
    {value && <span className="text-[13px] text-text-muted">{value}</span>}
    <ChevronRight size={16} className="text-text-muted" />
  </button>
);

export const ProfilePage = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { isLoading: authLoading, isError: authError, refetch } = useAuth();
  const { data: items = [] } = useUserItems(currentUser?.id);
  const { data: wishlist = [] } = useWishlist(currentUser?.id);
  const { data: exchanges = [] } = useExchanges(currentUser?.id);

  // Still authenticating
  if (authLoading) {
    return (
      <Shell>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </Shell>
    );
  }

  // Auth failed or returned no user
  if (!currentUser) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-6 text-center">
          <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h3 className="text-[17px] font-semibold">
            {authError ? 'Ошибка входа' : 'Не авторизован'}
          </h3>
          <p className="text-[13px] text-text-secondary">
            {authError
              ? 'Не удалось войти через Telegram. Попробуйте ещё раз.'
              : 'Откройте приложение через Telegram для авторизации.'}
          </p>
          {authError && (
            <Button
              variant="primary"
              onClick={() => { triggerHaptic('medium'); refetch(); }}
              className="mt-2"
            >
              <RefreshCw size={16} className="mr-2" />
              Повторить
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="px-5 pt-6 pb-6">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center mb-6"
        >
          <Avatar
            name={currentUser.first_name}
            lastName={currentUser.last_name ?? undefined}
            size="xl"
          />
          <h2 className="text-[20px] font-bold mt-3">
            {currentUser.first_name} {currentUser.last_name ?? ''}
          </h2>
          {currentUser.username && (
            <p className="text-[13px] text-text-secondary">@{currentUser.username}</p>
          )}
          {currentUser.bio && (
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-[280px]">
              {currentUser.bio}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold">{items.length}</p>
              <p className="text-[11px] text-text-muted">Books</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[18px] font-bold">{currentUser.total_exchanges ?? 0}</p>
              <p className="text-[11px] text-text-muted">Exchanges</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <Star size={14} className="text-warning fill-warning" />
                <span className="text-[18px] font-bold">
                  {currentUser.rating > 0 ? currentUser.rating.toFixed(1) : '—'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">
                {currentUser.review_count > 0 
                  ? `${currentUser.review_count} Review${currentUser.review_count !== 1 ? 's' : ''}` 
                  : 'Rating'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Menu sections */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <Card padding={false} className="mb-3 p-1">
            <MenuItem
              icon={BookOpen}
              label="My Books"
              value={`${items.length}`}
              onClick={() => navigate('/my-books')}
            />
            <MenuItem
              icon={Heart}
              label="Wishlist"
              value={`${wishlist.length}`}
              onClick={() => navigate('/wishlist')}
            />
            <MenuItem
              icon={ArrowUpRight}
              label="Exchange History"
              value={`${exchanges.length}`}
              onClick={() => navigate('/exchanges')}
            />
          </Card>

          <Card padding={false} className="mb-3 p-1">
            <MenuItem
              icon={Settings}
              label="Settings"
              onClick={() => navigate('/settings')}
            />
          </Card>
        </motion.div>

        {/* Edit profile button */}
        <Button
          variant="secondary"
          fullWidth
          size="lg"
          className="mt-2"
          onClick={() => navigate('/settings')}
        >
          Edit Profile
        </Button>
      </div>
    </Shell>
  );
};
