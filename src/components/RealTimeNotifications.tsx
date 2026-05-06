import React, { useEffect, useState } from 'react';
import { Bell, X, Calendar, User } from 'lucide-react';
import { supabase } from '../db/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showCounter, setShowCounter] = useState(false);
  const [lastNotification, setLastNotification] = useState<any>(null);

  useEffect(() => {
    // Request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Decode barbershopId from token
    let barbershopId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      barbershopId = payload.barbershopId;
    } catch (e) {
      console.error('Error decoding token', e);
    }

    if (!barbershopId) return;

    // Set up real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `barbershop_id=eq.${barbershopId}`
        },
        async (payload) => {
          console.log('[REALTIME] New appointment received:', payload.new);
          
          // Fetch more info about the client if possible
          const { data: clientData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', payload.new.client_id)
            .single();

          const newNotif = {
            id: payload.new.id,
            clientName: clientData?.name || 'Novo Cliente',
            time: payload.new.start_time,
            date: payload.new.date,
            timestamp: new Date().getTime()
          };

          setNotifications(prev => [newNotif, ...prev]);
          setLastNotification(newNotif);
          setShowCounter(true);

          // 1. Play Alert Sound
          try {
            // Using a distinct, authoritative notification sound
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.7;
            audio.play().catch(e => console.log('Audio play blocked by browser:', e));
          } catch (e) {
            console.error('Error playing notification sound:', e);
          }

          // 2. Browser Push Notification (for mobile/desktop background)
          if ("Notification" in window && Notification.permission === "granted") {
            const browserNotif = new Notification("Novo Agendamento!", {
              body: `${clientData?.name || 'Cliente'} agendou para ${payload.new.date} às ${payload.new.start_time}`,
              icon: '/favicon.ico', // Adjust icon path if necessary
            });
            
            browserNotif.onclick = () => {
              window.focus();
              handleOpenAgenda();
            };
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const clearNotification = () => {
    setLastNotification(null);
  };

  const handleOpenAgenda = () => {
    setNotifications([]);
    setShowCounter(false);
    setLastNotification(null);
  };

  return (
    <>
      {/* Floating Notification Popup */}
      <AnimatePresence>
        {lastNotification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed bottom-6 right-6 z-[100] w-72 bg-white dark:bg-zinc-900 shadow-2xl rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
          >
            <div className="bg-black dark:bg-[#D4AF37] p-3 flex justify-between items-center">
              <div className="flex items-center gap-2 text-white dark:text-black">
                <Bell className="w-4 h-4 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider">Novo Agendamento!</span>
              </div>
              <button onClick={clearNotification} className="text-white/70 hover:text-white dark:text-black/70 dark:hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded-lg">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{lastNotification.clientName}</h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(lastNotification.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {lastNotification.time}
                  </p>
                </div>
              </div>
              
              <Link 
                to="/admin/agenda" 
                onClick={handleOpenAgenda}
                className="mt-4 block w-full bg-gray-900 dark:bg-zinc-800 text-white text-center py-2.5 rounded-xl text-xs font-bold hover:bg-black dark:hover:bg-zinc-700 transition-colors shadow-sm"
              >
                Ver na Agenda
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Floating Button (only shows if there are unread notifications) */}
      <AnimatePresence>
        {notifications.length > 0 && !lastNotification && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-6 right-6 z-[90]"
          >
            <Link 
              to="/admin/agenda"
              onClick={() => { setNotifications([]); setShowCounter(false); }}
              className="group relative flex items-center justify-center w-14 h-14 bg-[#D4AF37] text-black rounded-full shadow-lg hover:scale-110 transition-transform"
            >
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                {notifications.length}
              </span>
              
              {/* Tooltip on hover */}
              <div className="absolute right-full mr-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{notifications.length} agendamentos novos</span>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
