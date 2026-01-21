/**
 * Fiscal Year Notifications Component
 * مكون إشعارات السنة المالية
 */

import { useState, useEffect } from 'react';
import { useFiscalYear } from '../context/FiscalYearContext';
import { useLang } from '../hooks/useLang';
import { 
  FaBell, FaExclamationTriangle, FaInfoCircle, 
  FaTimesCircle, FaTimes, FaChevronDown, FaChevronUp 
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

/**
 * Notification Bell with Badge
 */
export function NotificationBell({ className = '' }) {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/fiscal-years/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {
        console.error('Error fetching notifications:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const highPriorityCount = notifications.filter(n => n.priority === 'high').length;
  const hasNotifications = notifications.length > 0;

  const handleAction = (action) => {
    setShowDropdown(false);
    switch (action) {
      case 'review_entries':
      case 'review_journal':
        navigate('/journal');
        break;
      case 'close_year':
      case 'close_temporary':
      case 'create_year':
        navigate('/fiscal-years');
        break;
      default:
        navigate('/fiscal-years');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'error': return <FaTimesCircle className="text-red-500" />;
      case 'warning': return <FaExclamationTriangle className="text-yellow-500" />;
      default: return <FaInfoCircle className="text-blue-500" />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <FaBell className={`text-xl ${hasNotifications ? 'text-yellow-600' : 'text-gray-500'}`} />
        {hasNotifications && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-xs text-white ${
            highPriorityCount > 0 ? 'bg-red-500' : 'bg-yellow-500'
          }`}>
            {notifications.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          <div 
            className={`absolute ${isAr ? 'left-0' : 'right-0'} top-full mt-2 w-80 bg-white rounded-lg shadow-lg border z-50`}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-bold">
                {isAr ? 'الإشعارات' : 'Notifications'}
              </h3>
              <button 
                onClick={() => setShowDropdown(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  {isAr ? 'جارٍ التحميل...' : 'Loading...'}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {isAr ? 'لا توجد إشعارات' : 'No notifications'}
                </div>
              ) : (
                notifications.map((notif, idx) => (
                  <div 
                    key={notif.id || idx}
                    className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${
                      notif.priority === 'high' ? 'bg-red-50' : ''
                    }`}
                    onClick={() => handleAction(notif.action)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-1">{notif.icon || getIcon(notif.type)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {isAr ? notif.title : notif.titleEn}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {isAr ? notif.message : notif.messageEn}
                        </div>
                        {notif.actionLabel && (
                          <button className="text-xs text-primary-600 hover:underline mt-2">
                            {isAr ? notif.actionLabel : notif.actionLabelEn}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-2 border-t">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/fiscal-years');
                  }}
                  className="w-full text-center text-sm text-primary-600 hover:underline"
                >
                  {isAr ? 'عرض الكل' : 'View All'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Inline Notifications Banner
 */
export function NotificationsBanner({ className = '' }) {
  const [notifications, setNotifications] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/fiscal-years/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications?.filter(n => n.priority === 'high') || []);
        }
      } catch (e) {
        console.error('Error fetching notifications:', e);
      }
    };

    fetchNotifications();
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg ${className}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="p-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <FaExclamationTriangle className="text-yellow-600" />
          <span className="font-medium text-yellow-800">
            {isAr 
              ? `${notifications.length} إشعار مهم يتطلب انتباهك`
              : `${notifications.length} important notification(s) require your attention`
            }
          </span>
        </div>
        {expanded ? <FaChevronUp /> : <FaChevronDown />}
      </div>

      {expanded && (
        <div className="border-t border-yellow-200">
          {notifications.map((notif, idx) => (
            <div 
              key={notif.id || idx}
              className="p-3 border-b border-yellow-100 last:border-0 hover:bg-yellow-100"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{notif.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{isAr ? notif.title : notif.titleEn}</div>
                  <div className="text-sm text-yellow-700">{isAr ? notif.message : notif.messageEn}</div>
                </div>
                {notif.action && (
                  <button
                    onClick={() => navigate('/fiscal-years')}
                    className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                  >
                    {isAr ? notif.actionLabel : notif.actionLabelEn}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
