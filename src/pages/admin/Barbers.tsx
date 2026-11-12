import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Plus, User, Check, X, Scissors, Layers, CheckSquare, Square, Edit2, Camera, Trash2, Loader2 } from 'lucide-react';
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
}

export default function Barbers() {
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [newBarber, setNewBarber] = useState('');
  const [newCommission, setNewCommission] = useState(50);
  const [newSelectedServices, setNewSelectedServices] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [uploadingNewPhoto, setUploadingNewPhoto] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  
  // Editing state
  const [editingBarber, setEditingBarber] = useState<BarberItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCommission, setEditCommission] = useState(50);
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [segment, setSegment] = useState('barbershop');
  const [isLoading, setIsLoading] = useState(false);

  const fetchBarbers = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/barbers', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
          return [];
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        if (Array.isArray(data)) setBarbers(data);
        else console.error('Expected array for barbers, got:', data);
      })
      .catch(console.error);
  };

  const fetchServices = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/services', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setServices(data.filter(s => s.active !== false));
          // Preselect all services for a new professional by default
          setNewSelectedServices(data.map(s => s.id.toString()));
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchBarbers();
    fetchServices();
    const token = localStorage.getItem('token');
    fetch('/api/admin/shop-info', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.segment) setSegment(data.segment);
      })
      .catch(console.error);
  }, []);

  const handleToggleNewService = (serviceId: string) => {
    setNewSelectedServices(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAllNew = () => {
    if (newSelectedServices.length === services.length) {
      setNewSelectedServices([]);
    } else {
      setNewSelectedServices(services.map(s => s.id.toString()));
    }
  };

  const handleToggleEditService = (serviceId: string) => {
    setEditSelectedServices(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAllEdit = () => {
    if (editSelectedServices.length === services.length) {
      setEditSelectedServices([]);
    } else {
      setEditSelectedServices(services.map(s => s.id.toString()));
    }
  };

  const handleUploadPhoto = async (file: File, isEdit: boolean) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    if (isEdit) setUploadingEditPhoto(true);
    else setUploadingNewPhoto(true);

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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filePath,
          content: base64Content,
          contentType: file.type
        })
      });

      if (!res.ok) throw new Error('Upload falhou');
      const { publicUrl } = await res.json();
      if (isEdit) {
        setEditPhotoUrl(publicUrl);
      } else {
        setNewPhotoUrl(publicUrl);
      }
      toast.success('Foto carregada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      if (isEdit) setUploadingEditPhoto(false);
      else setUploadingNewPhoto(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBarber.trim()) {
      toast.error('Informe o nome do profissional');
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/barbers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: newBarber.trim(), 
          commission_percentage: newCommission,
          service_ids: newSelectedServices,
          photo_url: newPhotoUrl || null
        })
      });

      if (res.ok) {
        toast.success('Profissional cadastrado com sucesso!');
        setNewBarber('');
        setNewCommission(50);
        setNewPhotoUrl('');
        setNewSelectedServices(services.map(s => s.id.toString()));
        fetchBarbers();
      } else {
        toast.error('Erro ao cadastrar profissional');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (barber: BarberItem) => {
    setEditingBarber(barber);
    setEditName(barber.name);
    setEditCommission(barber.commission_percentage || 50);
    setEditPhotoUrl(barber.photo_url || barber.photoUrl || '');
    // If barber has service_ids array, use it; otherwise default to all services
    const currentIds = Array.isArray(barber.service_ids) && barber.service_ids.length > 0
      ? barber.service_ids.map(String)
      : services.map(s => s.id.toString());
    setEditSelectedServices(currentIds);
  };

  const saveEdit = async () => {
    if (!editingBarber) return;
    if (!editName.trim()) {
      toast.error('Informe o nome');
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/barbers/${editingBarber.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          commission_percentage: Number(editCommission),
          service_ids: editSelectedServices,
          photo_url: editPhotoUrl || null
        })
      });

      if (res.ok) {
        toast.success('Profissional atualizado com sucesso!');
        setEditingBarber(null);
        fetchBarbers();
      } else {
        toast.error('Erro ao atualizar profissional');
      }
    } catch (err) {
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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !barber.active })
      });
      fetchBarbers();
    } catch (err) {
      toast.error('Erro ao alterar status');
    }
  };

  const currentPreset = getSegment(segment);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            {currentPreset.terms.professionalPlural}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Cadastre os {currentPreset.terms.professionalPlural.toLowerCase()} e defina quais {currentPreset.terms.servicePlural.toLowerCase()} cada um realiza
          </p>
        </div>
        <span className="text-xs px-3.5 py-1.5 rounded-full font-semibold bg-[#D4AF37]/10 text-[#D4AF37] self-start sm:self-auto border border-[#D4AF37]/20">
          Nicho: {currentPreset.name}
        </span>
      </div>

      {/* Cadastro de Novo Profissional com seleção de serviços */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#D4AF37]" />
          <span>Novo(a) {currentPreset.terms.professional}</span>
        </h2>

        <form onSubmit={handleAdd} className="space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Foto do Profissional */}
            <div className="flex items-center gap-3 shrink-0">
              <input 
                type="file" 
                ref={newFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0], false);
                }}
              />
              <div 
                onClick={() => newFileInputRef.current?.click()}
                className="relative group w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] cursor-pointer overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-zinc-800 transition-colors shrink-0"
                title="Clique para adicionar foto do profissional"
              >
                {uploadingNewPhoto ? (
                  <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                ) : newPhotoUrl ? (
                  <>
                    <img src={newPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Camera className="w-4 h-4" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-[#D4AF37]">
                    <Camera className="w-5 h-5" />
                    <span className="text-[9px] font-medium leading-none mt-1">Foto</span>
                  </div>
                )}
              </div>
              {newPhotoUrl && (
                <button
                  type="button"
                  onClick={() => setNewPhotoUrl('')}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                  title="Remover foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <input 
              type="text" 
              value={newBarber}
              onChange={e => setNewBarber(e.target.value)}
              placeholder={`Nome completo do(a) ${currentPreset.terms.professional.toLowerCase()}`}
              className="flex-1 w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-white transition-colors placeholder:text-gray-400"
            />
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 shrink-0">
              <span className="text-sm text-gray-400">Comissão:</span>
              <input 
                type="number" 
                value={newCommission}
                onChange={e => setNewCommission(Number(e.target.value))}
                min={0}
                max={100}
                className="w-14 bg-transparent text-gray-900 dark:text-gray-100 font-bold outline-none text-center"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
            <button 
              type="submit" 
              disabled={isLoading || uploadingNewPhoto || !newBarber.trim()}
              className="bg-black dark:bg-[#D4AF37] text-white dark:text-black px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" /> Adicionar
            </button>
          </div>

          {/* Seleção de Serviços que o profissional realiza */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {currentPreset.terms.servicePlural} que este(a) {currentPreset.terms.professional.toLowerCase()} realiza:
              </label>
              {services.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllNew}
                  className="text-xs text-[#D4AF37] hover:underline font-medium"
                >
                  {newSelectedServices.length === services.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              )}
            </div>

            {services.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                Nenhum {currentPreset.terms.service.toLowerCase()} cadastrado ainda. Cadastre serviços na aba "{currentPreset.terms.servicePlural}".
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {services.map(service => {
                  const isChecked = newSelectedServices.includes(service.id.toString());
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleToggleNewService(service.id.toString())}
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
                      <span className="font-mono text-gray-400 shrink-0">R${service.price.toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Modal / Painel de Edição de Profissional */}
      {editingBarber && (
        <div className="bg-amber-500/5 dark:bg-[#D4AF37]/5 border-2 border-amber-500/30 dark:border-[#D4AF37]/30 p-6 rounded-2xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#D4AF37]" />
              <span>Editando: {editingBarber.name}</span>
            </h3>
            <button 
              onClick={() => setEditingBarber(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Foto no modo edição */}
            <div className="flex items-center gap-3 shrink-0">
              <input 
                type="file" 
                ref={editFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0], true);
                }}
              />
              <div 
                onClick={() => editFileInputRef.current?.click()}
                className="relative group w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] cursor-pointer overflow-hidden flex items-center justify-center bg-white dark:bg-zinc-800 transition-colors shrink-0"
                title="Clique para trocar foto do profissional"
              >
                {uploadingEditPhoto ? (
                  <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                ) : editPhotoUrl ? (
                  <>
                    <img src={editPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Camera className="w-4 h-4" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-[#D4AF37]">
                    <Camera className="w-5 h-5" />
                    <span className="text-[9px] font-medium leading-none mt-1">Foto</span>
                  </div>
                )}
              </div>
              {editPhotoUrl && (
                <button
                  type="button"
                  onClick={() => setEditPhotoUrl('')}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                  title="Remover foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome</label>
              <input 
                type="text" 
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-2.5 text-sm outline-none"
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Comissão (%)</label>
              <input 
                type="number" 
                value={editCommission}
                onChange={e => setEditCommission(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-2.5 text-sm outline-none font-bold"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {currentPreset.terms.servicePlural} que este(a) profissional realiza:
              </label>
              <button
                type="button"
                onClick={handleSelectAllEdit}
                className="text-xs text-[#D4AF37] hover:underline font-medium"
              >
                {editSelectedServices.length === services.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {services.map(service => {
                const isChecked = editSelectedServices.includes(service.id.toString());
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleToggleEditService(service.id.toString())}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all ${
                      isChecked
                        ? 'border-black dark:border-[#D4AF37] bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium shadow-sm'
                        : 'border-gray-200 dark:border-zinc-800 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="truncate">{service.name}</span>
                    </div>
                    <span className="font-mono text-gray-400 shrink-0">R${service.price.toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingBarber(null)}
              className="px-4 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={isLoading || !editName.trim()}
              className="bg-black dark:bg-[#D4AF37] text-white dark:text-black px-6 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* Lista de Profissionais Cadastrados */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center justify-between">
          <span>Equipe ({barbers.length})</span>
          <span className="text-xs text-gray-400 font-normal">Clique em Editar para ajustar os serviços</span>
        </h2>

        <div className="space-y-3">
          {(barbers || []).map(barber => {
            const barberServiceIds = Array.isArray(barber.service_ids) && barber.service_ids.length > 0
              ? barber.service_ids.map(String)
              : [];
            
            const performsAll = barberServiceIds.length === 0 || barberServiceIds.length === services.length;
            const assignedServices = services.filter(s => barberServiceIds.includes(s.id.toString()));

            return (
              <div 
                key={barber.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 rounded-xl hover:border-gray-200 dark:hover:border-zinc-700 transition-colors gap-4"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-700 rounded-full flex items-center justify-center shrink-0 mt-1 sm:mt-0 overflow-hidden border border-gray-200 dark:border-zinc-700">
                    {(barber.photo_url || barber.photoUrl) ? (
                      <img 
                        src={barber.photo_url || barber.photoUrl || ''} 
                        alt={barber.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <User className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-base">{barber.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        barber.active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        {barber.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>{barber.commission_percentage || 50}% comissão</span>
                      <span>•</span>
                      {performsAll ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          Atende todos os {services.length} {currentPreset.terms.servicePlural.toLowerCase()}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="font-medium text-[#D4AF37]">{assignedServices.length} {currentPreset.terms.servicePlural.toLowerCase()}:</span>
                          {assignedServices.slice(0, 3).map(s => (
                            <span key={s.id} className="bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-[10px] text-gray-700 dark:text-gray-300">
                              {s.name}
                            </span>
                          ))}
                          {assignedServices.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{assignedServices.length - 3} mais</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button 
                    onClick={() => startEditing(barber)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Editar Serviços</span>
                  </button>
                  
                  <button 
                    onClick={() => toggleActiveStatus(barber)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${barber.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
                    title={barber.active ? 'Desativar profissional' : 'Ativar profissional'}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${barber.active ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            );
          })}

          {(!barbers || barbers.length === 0) && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              Nenhum {currentPreset.terms.professional.toLowerCase()} cadastrado ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
