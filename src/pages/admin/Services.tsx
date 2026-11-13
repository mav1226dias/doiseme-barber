import { useState, useEffect, useRef, FormEvent } from 'react';
import { Plus, Scissors, Trash2, Sparkles, Camera, Edit2, X, Loader2 } from 'lucide-react';
import { getSegment } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';
import ConfirmModal from '../../components/ConfirmModal';
import { toast } from 'sonner';

interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active?: boolean;
  image_url?: string | null;
  imageUrl?: string | null;
}

export default function Services() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [formData, setFormData] = useState({ name: '', duration: '', price: '', image_url: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit State
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', duration: '', price: '', image_url: '' });
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [segment, setSegment] = useState('barbershop');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  const fetchServices = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/services', {
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
        if (Array.isArray(data)) setServices(data);
        else console.error('Expected array for services, got:', data);
      })
      .catch(console.error);
  };

  useEffect(() => {
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

    if (isEdit) setUploadingEditImage(true);
    else setUploadingImage(true);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `services/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      
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
        setEditFormData(prev => ({ ...prev, image_url: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, image_url: publicUrl }));
      }
      toast.success('Foto do procedimento carregada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      if (isEdit) setUploadingEditImage(false);
      else setUploadingImage(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.duration || !formData.price) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          durationMinutes: parseInt(formData.duration),
          price: parseFloat(formData.price),
          image_url: formData.image_url || undefined
        })
      });

      if (res.ok) {
        toast.success('Procedimento cadastrado com sucesso!');
        setFormData({ name: '', duration: '', price: '', image_url: '' });
        fetchServices();
      } else {
        toast.error('Erro ao cadastrar serviço');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (service: ServiceItem) => {
    setEditingService(service);
    setEditFormData({
      name: service.name,
      duration: service.durationMinutes.toString(),
      price: service.price.toString(),
      image_url: service.image_url || service.imageUrl || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingService) return;
    if (!editFormData.name.trim() || !editFormData.duration || !editFormData.price) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/services/${editingService.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          durationMinutes: parseInt(editFormData.duration),
          price: parseFloat(editFormData.price),
          image_url: editFormData.image_url || null
        })
      });

      if (res.ok) {
        toast.success('Serviço atualizado com sucesso!');
        setEditingService(null);
        fetchServices();
      } else {
        toast.error('Erro ao salvar alterações');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteServiceId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteServiceId) return;
    setDeletingService(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/services/${deleteServiceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Serviço excluído');
        setDeleteServiceId(null);
        fetchServices();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao excluir serviço.');
      }
    } catch {
      toast.error('Erro de rede ao excluir.');
    } finally {
      setDeletingService(false);
    }
  };

  const currentPreset = getSegment(segment);

  const handleApplySuggested = (suggested: { name: string; durationMinutes: number; price: number }) => {
    setFormData(prev => ({
      ...prev,
      name: suggested.name,
      duration: suggested.durationMinutes.toString(),
      price: suggested.price.toString()
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            {currentPreset.terms.servicePlural}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Cadastre os procedimentos com fotos ilustrativas para seus clientes visualizarem no agendamento
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#D4AF37]/10 text-[#D4AF37] self-start sm:self-auto border border-[#D4AF37]/20">
          Nicho: {currentPreset.name}
        </span>
      </div>

      {/* Sugestões do Nicho */}
      {currentPreset.suggestedServices && currentPreset.suggestedServices.length > 0 && (
        <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Sugestões comuns para {currentPreset.name} (clique para preencher)
          </div>
          <div className="flex flex-wrap gap-2">
            {currentPreset.suggestedServices.map(item => (
              <button
                key={item.name}
                type="button"
                onClick={() => handleApplySuggested(item)}
                className="text-xs bg-white dark:bg-zinc-800 hover:bg-[#D4AF37]/10 border border-gray-200 dark:border-zinc-700 hover:border-[#D4AF37] px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1.5"
              >
                <span>{item.name}</span>
                <span className="text-gray-400">({item.durationMinutes} min • R${item.price})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cadastro de Novo Serviço com Foto */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#D4AF37]" />
          <span>Novo(a) {currentPreset.terms.service}</span>
        </h2>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Foto / Thumbnail do Procedimento */}
            <div className="flex items-center gap-2 shrink-0">
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0], false);
                }}
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative group w-14 h-14 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] cursor-pointer overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-zinc-800 transition-colors shrink-0"
                title="Clique para adicionar foto do procedimento"
              >
                {uploadingImage ? (
                  <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                ) : formData.image_url ? (
                  <>
                    <img src={formData.image_url} alt="Foto" className="w-full h-full object-cover" />
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
              {formData.image_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                  title="Remover foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 w-full">
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Nome do ${currentPreset.terms.service.toLowerCase()} (ex: Corte Degradê, Consulta...)`}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-white transition-colors placeholder:text-gray-400 text-sm"
              />
            </div>

            <div className="w-full sm:w-36">
              <input 
                type="number" 
                value={formData.duration}
                onChange={e => setFormData({ ...formData, duration: e.target.value })}
                placeholder="Duração (min)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-white transition-colors placeholder:text-gray-400 text-sm"
              />
            </div>

            <div className="w-full sm:w-36">
              <input 
                type="number" 
                step="0.01"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                placeholder="Valor (R$)"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-white transition-colors placeholder:text-gray-400 text-sm font-bold"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || uploadingImage || !formData.name.trim()}
              className="bg-black dark:bg-[#D4AF37] text-white dark:text-black px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto text-sm"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </form>
      </div>

      {/* Modal / Painel de Edição de Procedimento */}
      {editingService && (
        <div className="bg-amber-500/5 dark:bg-[#D4AF37]/5 border-2 border-amber-500/30 dark:border-[#D4AF37]/30 p-6 rounded-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#D4AF37]" />
              <span>Editar {currentPreset.terms.service}: {editingService.name}</span>
            </h3>
            <button 
              onClick={() => setEditingService(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Foto no modo edição */}
            <div className="flex items-center gap-2 shrink-0">
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
                className="relative group w-14 h-14 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#D4AF37] dark:hover:border-[#D4AF37] cursor-pointer overflow-hidden flex items-center justify-center bg-white dark:bg-zinc-800 transition-colors shrink-0"
                title="Clique para trocar foto do procedimento"
              >
                {uploadingEditImage ? (
                  <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                ) : editFormData.image_url ? (
                  <>
                    <img src={editFormData.image_url} alt="Foto" className="w-full h-full object-cover" />
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
              {editFormData.image_url && (
                <button
                  type="button"
                  onClick={() => setEditFormData(prev => ({ ...prev, image_url: '' }))}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                  title="Remover foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome do {currentPreset.terms.service}</label>
              <input 
                type="text" 
                value={editFormData.name}
                onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-2.5 text-sm outline-none"
              />
            </div>

            <div className="w-full sm:w-32">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Duração (min)</label>
              <input 
                type="number" 
                value={editFormData.duration}
                onChange={e => setEditFormData({ ...editFormData, duration: e.target.value })}
                className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-2.5 text-sm outline-none"
              />
            </div>

            <div className="w-full sm:w-32">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Preço (R$)</label>
              <input 
                type="number" 
                step="0.01"
                value={editFormData.price}
                onChange={e => setEditFormData({ ...editFormData, price: e.target.value })}
                className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-2.5 text-sm outline-none font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingService(null)}
              className="px-4 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSubmitting || uploadingEditImage || !editFormData.name.trim()}
              className="bg-black dark:bg-[#D4AF37] text-white dark:text-black px-6 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* Lista de Serviços */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center justify-between">
          <span>Catálogo ({services.length})</span>
          <span className="text-xs text-gray-400 font-normal">Fotos são exibidas diretamente na página de agendamento</span>
        </h2>

        <div className="space-y-4">
          {(services || []).map(service => {
            const photo = service.image_url || service.imageUrl;
            return (
              <div 
                key={service.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 rounded-xl hover:border-gray-200 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 dark:border-zinc-700">
                    {photo ? (
                      <img src={photo} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <SegmentIcon iconName={currentPreset.icon} className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-base">{service.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {service.durationMinutes} minutos {photo ? '• Com foto' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-lg font-mono">
                    R$ {Number(service.price).toFixed(2)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(service)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Editar serviço e foto"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Editar</span>
                    </button>

                    <button 
                      onClick={() => handleDelete(service.id)}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                      title="Excluir serviço"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {(!services || services.length === 0) && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum serviço cadastrado.</div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteServiceId)}
        title="Excluir serviço?"
        description="Tem certeza que deseja excluir este serviço? Agendamentos vinculados a ele também serão removidos."
        confirmLabel="Excluir Serviço"
        loading={deletingService}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deletingService && setDeleteServiceId(null)}
      />
    </div>
  );
}
