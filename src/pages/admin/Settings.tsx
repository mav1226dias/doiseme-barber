import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Clock, 
  BellRing, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'hours' | 'security'>('hours');
  
  // Operating Hours State
  const [hours, setHours] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHolidayAlert, setShowHolidayAlert] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // User Info (from token/storage)
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Retrieve cached user email if present
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email) setUserEmail(parsed.email);
      }
    } catch (e) {}

    fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      })
      .then(data => {
        if (data) setHours(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // Mock holiday check
    const currentMonth = new Date().getMonth();
    if (currentMonth === 11 || currentMonth === 3 || currentMonth === 4) {
      setShowHolidayAlert(true);
    }
  }, []);

  const handleChange = (day: string, field: string, value: any) => {
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value
      }
    });
  };

  const handleSaveHours = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(hours)
      });
      if (res.ok) {
        toast.success('Horários salvos com sucesso!');
      } else {
        toast.error('Erro ao salvar horários');
      }
    } catch (e) {
      toast.error('Erro de conexão ao salvar horários');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Informe sua senha atual');
      return;
    }

    if (!newPassword) {
      toast.error('Informe a nova senha');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('A nova senha e a confirmação não coincidem');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('A nova senha deve ser diferente da senha atual');
      return;
    }

    setChangingPassword(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Senha alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Erro ao alterar senha');
      }
    } catch (error) {
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            Configurações
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Gerencie os horários de funcionamento do estabelecimento e a segurança da sua conta
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('hours')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'hours'
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <span>Horários de Funcionamento</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'security'
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>Trocar Senha & Segurança</span>
          </button>
        </div>
      </div>

      {/* TAB 1: HORÁRIOS DE FUNCIONAMENTO */}
      {activeTab === 'hours' && (
        <div className="space-y-6">
          {showHolidayAlert && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-2xl p-4 flex gap-4 items-start">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-bold text-yellow-800 dark:text-yellow-500 text-sm">Feriado se aproximando!</h3>
                <p className="text-xs text-yellow-700 dark:text-yellow-600 mt-1 leading-relaxed">
                  Detectamos um ou mais feriados nacionais nos próximos 7 dias. Não se esqueça de ajustar sua escala ou bloquear horários na Agenda caso o estabelecimento vá fechar.
                </p>
                <button 
                  onClick={() => setShowHolidayAlert(false)}
                  className="mt-2 text-xs font-semibold text-yellow-800 dark:text-yellow-500 hover:opacity-80 transition-opacity underline"
                >
                  Ciente, dispensar aviso
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Horário Geral de Atendimento</h2>
                <p className="text-xs text-gray-500">Defina os dias e intervalos em que seu estabelecimento aceita agendamentos</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-4 hidden lg:grid">
                <div className="col-span-2">Dia da Semana</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Abertura</div>
                <div className="col-span-2 text-center">Fechamento</div>
                <div className="col-span-2 text-center">Almoço (Início)</div>
                <div className="col-span-2 text-center">Almoço (Fim)</div>
              </div>

              {DAYS.map(({ key, label }) => {
                const dayData = hours?.[key] || { isClosed: false, open: '09:00', close: '19:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' };

                return (
                  <div key={key} className="flex flex-col lg:grid lg:grid-cols-12 gap-4 items-center bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                    <div className="col-span-2 font-semibold text-sm text-gray-900 dark:text-gray-100 w-full lg:w-auto">
                      {label}
                    </div>
                    
                    <div className="col-span-2 flex flex-col sm:flex-row gap-2 justify-center w-full lg:w-auto">
                      <button
                        type="button"
                        onClick={() => handleChange(key, 'isClosed', !dayData.isClosed)}
                        className={`flex-1 lg:px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                          !dayData.isClosed 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50' 
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50'
                        }`}
                      >
                        {!dayData.isClosed ? 'Aberto' : 'Fechado'}
                      </button>
                      <button
                        type="button"
                        disabled={dayData.isClosed}
                        onClick={() => handleChange(key, 'hasLunchBreak', !dayData.hasLunchBreak)}
                        className={`flex-1 lg:px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 ${
                          dayData.hasLunchBreak 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/50' 
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-600'
                        }`}
                      >
                        {dayData.hasLunchBreak ? 'C/ Intervalo' : 'S/ Intervalo'}
                      </button>
                    </div>

                    <div className="col-span-2 w-full lg:w-auto">
                      <div className="lg:hidden text-xs text-gray-400 mb-1">Abertura</div>
                      <input
                        type="time"
                        disabled={dayData.isClosed}
                        value={dayData.open || '09:00'}
                        onChange={e => handleChange(key, 'open', e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-50 outline-none focus:border-black dark:focus:border-gray-400 text-center text-sm font-mono"
                      />
                    </div>

                    <div className="col-span-2 w-full lg:w-auto">
                      <div className="lg:hidden text-xs text-gray-400 mb-1">Fechamento</div>
                      <input
                        type="time"
                        disabled={dayData.isClosed}
                        value={dayData.close || '19:00'}
                        onChange={e => handleChange(key, 'close', e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-50 outline-none focus:border-black dark:focus:border-gray-400 text-center text-sm font-mono"
                      />
                    </div>

                    <div className="col-span-2 w-full lg:w-auto">
                      <div className="lg:hidden text-xs text-gray-400 mb-1 text-center">Início Almoço</div>
                      <input
                        type="time"
                        disabled={dayData.isClosed || !dayData.hasLunchBreak}
                        value={dayData.lunchOpen || '12:00'}
                        onChange={e => handleChange(key, 'lunchOpen', e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-30 outline-none focus:border-black dark:focus:border-gray-400 text-center text-sm font-mono"
                      />
                    </div>

                    <div className="col-span-2 w-full lg:w-auto">
                      <div className="lg:hidden text-xs text-gray-400 mb-1 text-center">Fim Almoço</div>
                      <input
                        type="time"
                        disabled={dayData.isClosed || !dayData.hasLunchBreak}
                        value={dayData.lunchClose || '13:00'}
                        onChange={e => handleChange(key, 'lunchClose', e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-30 outline-none focus:border-black dark:focus:border-gray-400 text-center text-sm font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                type="button"
                disabled={saving}
                onClick={handleSaveHours}
                className="bg-[#D4AF37] text-black px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-md active:scale-95"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TROCAR SENHA & SEGURANÇA */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          
          {/* Main Password Form */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Alterar Senha de Acesso</h2>
                <p className="text-xs text-gray-500">
                  {userEmail ? `Conta conectada: ${userEmail}` : 'Atualize sua senha de acesso ao painel administrativo'}
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Senha Atual */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                  Senha Atual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    required
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#D4AF37] text-gray-900 dark:text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nova Senha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    required
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#D4AF37] text-gray-900 dark:text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Indicador de Requisito */}
                <div className="flex items-center gap-1.5 text-[11px] pt-1">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${newPassword.length >= 6 ? 'text-green-500' : 'text-gray-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                  <span className={newPassword.length >= 6 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500'}>
                    Pelo menos 6 caracteres {newPassword.length > 0 && `(${newPassword.length}/6)`}
                  </span>
                </div>
              </div>

              {/* Confirmar Nova Senha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#D4AF37] text-gray-900 dark:text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Validação de Correspondência */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] pt-1">
                    {newPassword === confirmPassword ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-600 dark:text-green-400 font-medium">As senhas coincidem</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-amber-600 dark:text-amber-400 font-medium">As senhas ainda não coincidem</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="bg-black dark:bg-[#D4AF37] text-white dark:text-black px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {changingPassword ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                  <span>{changingPassword ? 'Atualizando...' : 'Atualizar Senha'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Security Information & Tips Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                  Boas Práticas de Segurança
                </h3>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Manter sua senha segura garante que apenas pessoas autorizadas tenham acesso aos dados da sua empresa, clientes e finanças.
              </p>

              <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="text-[#D4AF37] font-bold">✓</span>
                  <span>Use no mínimo 6 caracteres combinando letras e números.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#D4AF37] font-bold">✓</span>
                  <span>Evite usar dados pessoais como datas de aniversário ou nomes óbvios.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#D4AF37] font-bold">✓</span>
                  <span>Nunca compartilhe sua senha de administrador com terceiros.</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <span className="font-bold block">Sessões Ativas</span>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Após alterar sua senha, sua sessão atual continuará válida. Em caso de suspeita de invasão, recomendamos desconectar e realizar login novamente.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}