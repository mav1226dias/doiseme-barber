import React, { useState, useEffect, useRef, FormEvent } from 'react';
import {
  Plus,
  User,
  X,
  CheckSquare,
  Square,
  Edit2,
  Camera,
  Trash2,
  Loader2,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { getSegment } from '../../lib/segments';
import { toast } from 'sonner';

interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

interface BarberItem {
  id: string;
  name: string;
  commission_percentage?: number;
  active: boolean;
  service_ids?: string[];
  photo_url?: string | null;
  photoUrl?: string | null;
  loginEmail?: string | null;
}

export default function Barbers() {
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [segment, setSegment] = useState('barbershop');

  // Unified Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<BarberItem | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalCommission, setModalCommission] = useState(50);
  const [modalSelectedServices, setModalSelectedServices] = useState<string[]>([]);
  const [modalPhotoUrl, setModalPhotoUrl] = useState('');
  const [modalLoginEmail, setModalLoginEmail] = useState('');
  const [modalLoginPassword, setModalLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [removeAccess, setRemoveAccess] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBarbers = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/barbers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
          return [];
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then((data) => {
        if (Array.isArray(data)) setBarbers(data);
        else console.error('Expected array for barbers, got:', data);
      })
      .catch(console.error);
  };

  const fetchServices = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/services', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setServices(data.filter((s) => s.active !== false));
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchBarbers();
    fetchServices();
    const token = localStorage.getItem('token');
    fetch('/api/admin/shop-info', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.segment) setSegment(data.segment);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && !uploadingPhoto) {
        setIsModalOpen(false);
        setEditingBarber(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, isLoading, uploadingPhoto]);

  const openCreateModal = () => {
    setEditingBarber(null);
    setModalName('');
    setModalCommission(50);
    setModalPhotoUrl('');
    setModalLoginEmail('');
    setModalLoginPassword('');
    setShowPassword(false);
    setRemoveAccess(false);
    setModalSelectedServices(services.map((s) => s.id.toString()));
    setIsModalOpen(true);
  };

  const openEditModal = (barber: BarberItem) => {
    setEditingBarber(barber);
    setModalName(barber.name);
    setModalCommission(barber.commission_percentage ?? 50);
    setModalPhotoUrl(barber.photo_url || barber.photoUrl || '');
    setModalLoginEmail(barber.loginEmail || '');
    setModalLoginPassword('');
    setShowPassword(false);
    setRemoveAccess(false);
    const currentIds =
      Array.isArray(barber.service_ids) && barber.service_ids.length > 0
        ? barber.service_ids.map(String)
        : services.map((s) => s.id.toString());
    setModalSelectedServices(currentIds);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isLoading || uploadingPhoto) return;
    setIsModalOpen(false);
    setEditingBarber(null);
  };

  const handleToggleService = (serviceId: string) => {
    setModalSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSelectAllServices = () => {
    if (modalSelectedServices.length === services.length) {
      setModalSelectedServices([]);
    } else {
      setModalSelectedServices(services.map((s) => s.id.toString()));
    }
  };

  const handleUploadPhoto = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `barbers/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const split = (reader.result as string).split(',');
          resolve(split[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Content = await base64Promise;
      const token = localStorage.getItem('token');

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          filePath,
          content: base64Content,
          contentType: file.type
        })
      });

      if (!res.ok) throw new Error('Upload falhou');
      const { publicUrl } = await res.json();
      setModalPhotoUrl(publicUrl);
      toast.success('Foto carregada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmitModal = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) {
      toast.error('Informe o nome do profissional');
      return;
    }

    const cleanLoginEmail = modalLoginEmail.trim();
    if (!editingBarber) {
      if (cleanLoginEmail && modalLoginPassword.length < 6) {
        toast.error('A senha de acesso individual deve ter no mínimo 6 caracteres.');
        return;
      }
    } else if (!removeAccess && cleanLoginEmail) {
      if (!editingBarber.loginEmail && modalLoginPassword.length < 6) {
        toast.error('Defina uma senha com no mínimo 6 caracteres para liberar o acesso.');
        return;
      }
      if (modalLoginPassword && modalLoginPassword.length < 6) {
        toast.error('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');

    try {
      if (editingBarber) {
        const res = await fetch(`/api/admin/barbers/${editingBarber.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: modalName.trim(),
            commission_percentage: Number(modalCommission),
            service_ids: modalSelectedServices,
            photo_url: modalPhotoUrl || null,
            removeAccess,
            ...(!removeAccess && cleanLoginEmail
              ? {
                  loginEmail: cleanLoginEmail,
                  ...(modalLoginPassword ? { loginPassword: modalLoginPassword } : {})
                }
              : {})
          })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success('Profissional atualizado com sucesso!');
          setIsModalOpen(false);
          setEditingBarber(null);
          fetchBarbers();
        } else {
          toast.error(data.error || 'Erro ao atualizar profissional');
        }
      } else {
        const res = await fetch('/api/admin/barbers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: modalName.trim(),
            commission_percentage: Number(modalCommission),
            service_ids: modalSelectedServices,
            photo_url: modalPhotoUrl || null,
            ...(cleanLoginEmail ? { loginEmail: cleanLoginEmail, loginPassword: modalLoginPassword } : {})
          })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success(
            cleanLoginEmail
              ? 'Profissional e acesso individual cadastrados com sucesso!'
              : 'Profissional cadastrado com sucesso!'
          );
          setIsModalOpen(false);
          fetchBarbers();
        } else {
          toast.error(data.error || 'Erro ao cadastrar profissional');
        }
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActiveStatus = async (barber: BarberItem) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/admin/barbers/${barber.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active: !barber.active })
      });
      fetchBarbers();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const currentPreset = getSegment(segment);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            {currentPreset.terms.professionalPlural}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Nicho: {currentPreset.name} · Gerencie equipe, comissões, serviços e acesso individual
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black px-5 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo(a) {currentPreset.terms.professional}
        </button>
      </div>

      {/* Lista de Profissionais Cadastrados */}
      <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Equipe ({barbers.length})
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Toque em Editar para ajustar dados, foto, serviços ou acesso
          </span>
        </div>

        <div className="space-y-3">
          {(barbers || []).map((barber) => {
            const barberServiceIds =
              Array.isArray(barber.service_ids) && barber.service_ids.length > 0
                ? barber.service_ids.map(String)
                : [];

            const performsAll = barberServiceIds.length === 0 || barberServiceIds.length === services.length;
            const assignedServices = services.filter((s) => barberServiceIds.includes(s.id.toString()));

            return (
              <div
                key={barber.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 rounded-xl hover:border-gray-300 dark:hover:border-zinc-700 transition-colors gap-4"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-700 rounded-full flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 overflow-hidden border border-gray-200 dark:border-zinc-700">
                    {barber.photo_url || barber.photoUrl ? (
                      <img
                        src={barber.photo_url || barber.photoUrl || ''}
                        alt={barber.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
                        {barber.name}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          barber.active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                        }`}
                      >
                        · {barber.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="tabular-nums">{barber.commission_percentage ?? 50}% comissão</span>
                      {barber.loginEmail && (
                        <>
                          <span>·</span>
                          <span className="text-gray-700 dark:text-gray-300 font-mono">
                            Login: {barber.loginEmail}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      {performsAll ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          Atende todos os {services.length} {currentPreset.terms.servicePlural.toLowerCase()}
                        </span>
                      ) : (
                        <span className="font-medium text-[#D4AF37]">
                          {assignedServices.length} {currentPreset.terms.servicePlural.toLowerCase()} selecionado(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-zinc-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(barber)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleActiveStatus(barber)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${
                      barber.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                    title={barber.active ? 'Desativar profissional' : 'Ativar profissional'}
                    aria-label={barber.active ? 'Desativar profissional' : 'Ativar profissional'}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                        barber.active ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}

          {(!barbers || barbers.length === 0) && (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum(a) {currentPreset.terms.professional.toLowerCase()} cadastrado(a) ainda.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-black dark:bg-[#D4AF37] text-white dark:text-black hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Cadastrar primeiro(a) {currentPreset.terms.professional.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Modal: Cadastrar ou Editar Profissional */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-bold font-serif text-gray-900 dark:text-white truncate">
                  {editingBarber
                    ? `Editar ${currentPreset.terms.professional}`
                    : `Novo(a) ${currentPreset.terms.professional}`}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {editingBarber
                    ? `Atualizando "${editingBarber.name}"`
                    : 'Defina foto, comissão, serviços atendidos e acesso individual'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isLoading || uploadingPhoto}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                aria-label="Fechar janela"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Foto, Nome e Comissão */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0]);
                      }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative group w-16 h-16 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#D4AF37] cursor-pointer overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-zinc-800 transition-colors shrink-0"
                      title="Clique para selecionar foto"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                      ) : modalPhotoUrl ? (
                        <>
                          <img src={modalPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Camera className="w-4 h-4" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-[#D4AF37]">
                          <Camera className="w-5 h-5" />
                          <span className="text-[10px] font-medium leading-none mt-1">Foto</span>
                        </div>
                      )}
                    </div>
                    {modalPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setModalPhotoUrl('')}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
                        title="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={modalName}
                      onChange={(e) => setModalName(e.target.value)}
                      placeholder={`Nome do(a) ${currentPreset.terms.professional.toLowerCase()}`}
                      className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="w-full sm:w-32 shrink-0">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                      Comissão (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={modalCommission}
                      onChange={(e) => setModalCommission(Number(e.target.value))}
                      className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[#D4AF37] tabular-nums"
                    />
                  </div>
                </div>

                {/* Serviços que realiza */}
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {currentPreset.terms.servicePlural} que realiza:
                    </label>
                    {services.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllServices}
                        className="text-xs text-[#D4AF37] hover:underline font-semibold"
                      >
                        {modalSelectedServices.length === services.length
                          ? 'Desmarcar Todos'
                          : 'Selecionar Todos'}
                      </button>
                    )}
                  </div>

                  {services.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Nenhum(a) {currentPreset.terms.service.toLowerCase()} cadastrado(a) ainda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {services.map((service) => {
                        const isChecked = modalSelectedServices.includes(service.id.toString());
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handleToggleService(service.id.toString())}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                              isChecked
                                ? 'border-black dark:border-[#D4AF37] bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-medium'
                                : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-black dark:text-[#D4AF37] shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400 shrink-0" />
                              )}
                              <span className="truncate">{service.name}</span>
                            </div>
                            <span className="font-mono text-gray-400 shrink-0 tabular-nums">
                              R$ {service.price.toFixed(0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Acesso Individual ao Painel */}
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                      <span>Acesso Individual ao Painel (Opcional)</span>
                    </div>
                    {editingBarber?.loginEmail && (
                      <button
                        type="button"
                        onClick={() => setRemoveAccess(!removeAccess)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                          removeAccess
                            ? 'bg-red-500 text-white border-red-500'
                            : 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30'
                        }`}
                      >
                        {removeAccess ? 'Acesso será removido ao salvar' : 'Revogar acesso individual'}
                      </button>
                    )}
                  </div>

                  {!editingBarber && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Ao definir e-mail e senha, o profissional entra no painel vendo apenas a própria agenda, clientes e comissão.
                    </p>
                  )}

                  {!removeAccess && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          E-mail de acesso
                        </label>
                        <input
                          type="email"
                          value={modalLoginEmail}
                          onChange={(e) => setModalLoginEmail(e.target.value)}
                          placeholder="profissional@empresa.com"
                          className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          {editingBarber?.loginEmail
                            ? 'Nova senha (vazio p/ manter)'
                            : 'Senha (mín. 6 caracteres)'}
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={modalLoginPassword}
                            onChange={(e) => setModalLoginPassword(e.target.value)}
                            placeholder={editingBarber?.loginEmail ? '•••••••• (opcional)' : 'Mínimo 6 caracteres'}
                            className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl pl-3.5 pr-10 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            aria-label="Mostrar ou ocultar senha"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 bg-gray-50 dark:bg-zinc-950/60 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isLoading || uploadingPhoto}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || uploadingPhoto || !modalName.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-black dark:bg-[#D4AF37] text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading
                    ? 'Salvando...'
                    : editingBarber
                    ? 'Salvar Alterações'
                    : `Cadastrar ${currentPreset.terms.professional}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
