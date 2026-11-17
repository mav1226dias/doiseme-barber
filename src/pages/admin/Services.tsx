import { useState, useEffect, useRef, FormEvent } from 'react';
import { Plus, Trash2, Sparkles, Camera, Edit2, X, Loader2 } from 'lucide-react';
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
  const [segment, setSegment] = useState('barbershop');

  // Unified Create / Edit Pop-up Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [modalForm, setModalForm] = useState({ name: '', duration: '', price: '', image_url: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  const fetchServices = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/services', {
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
        if (Array.isArray(data)) setServices(data);
        else console.error('Expected array for services, got:', data);
      })
      .catch(console.error);
  };

  useEffect(() => {
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
      if (e.key === 'Escape' && !isSubmitting && !uploadingImage) {
        setIsModalOpen(false);
        setEditingService(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, isSubmitting, uploadingImage]);

  const openCreateModal = (prefill?: { name: string; durationMinutes: number; price: number }) => {
    setEditingService(null);
    setModalForm({
      name: prefill?.name || '',
      duration: prefill ? String(prefill.durationMinutes) : '',
      price: prefill ? String(prefill.price) : '',
      image_url: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setModalForm({
      name: service.name,
      duration: String(service.durationMinutes),
      price: String(service.price),
      image_url: service.image_url || service.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting || uploadingImage) return;
    setIsModalOpen(false);
    setEditingService(null);
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

    setUploadingImage(true);
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
      setModalForm((prev) => ({ ...prev, image_url: publicUrl }));
      toast.success('Foto do procedimento carregada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitModal = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalForm.name.trim() || !modalForm.duration || !modalForm.price) {
      toast.error('Preencha nome, duração e valor');
      return;
    }

    const durationNum = parseInt(modalForm.duration, 10);
    const priceNum = parseFloat(modalForm.price);
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      toast.error('Informe uma duração válida em minutos');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Informe um valor válido');
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      if (editingService) {
        const res = await fetch(`/api/admin/services/${editingService.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: modalForm.name.trim(),
            durationMinutes: durationNum,
            price: priceNum,
            image_url: modalForm.image_url || null
          })
        });

        if (res.ok) {
          toast.success('Serviço atualizado com sucesso!');
          setIsModalOpen(false);
          setEditingService(null);
          fetchServices();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || 'Erro ao salvar alterações');
        }
      } else {
        const res = await fetch('/api/admin/services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: modalForm.name.trim(),
            durationMinutes: durationNum,
            price: priceNum,
            image_url: modalForm.image_url || undefined
          })
        });

        if (res.ok) {
          toast.success('Procedimento cadastrado com sucesso!');
          setIsModalOpen(false);
          fetchServices();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || 'Erro ao cadastrar serviço');
        }
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteServiceId) return;
    setDeletingService(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/services/${deleteServiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Serviço excluído');
        setDeleteServiceId(null);
        fetchServices();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erro ao excluir serviço.');
      }
    } catch {
      toast.error('Erro de rede ao excluir.');
    } finally {
      setDeletingService(false);
    }
  };

  const currentPreset = getSegment(segment);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            {currentPreset.terms.servicePlural}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Nicho: {currentPreset.name} · Cadastre e edite valores, duração e fotos do catálogo
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center justify-center gap-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black px-5 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo(a) {currentPreset.terms.service}
        </button>
      </div>

      {/* Sugestões Rápidas do Nicho */}
      {currentPreset.suggestedServices && currentPreset.suggestedServices.length > 0 && (
        <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Atalhos para {currentPreset.name} (toque para abrir já preenchido)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentPreset.suggestedServices.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => openCreateModal(item)}
                className="text-xs bg-white dark:bg-zinc-800 hover:bg-[#D4AF37]/10 border border-gray-200 dark:border-zinc-700 hover:border-[#D4AF37] px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{item.name}</span>
                <span className="text-gray-400 tabular-nums">({item.durationMinutes} min · R$ {item.price})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Serviços */}
      <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Catálogo ({services.length})
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Exibidos diretamente na sua página de agendamento
          </span>
        </div>

        <div className="space-y-3">
          {(services || []).map((service) => {
            const photo = service.image_url || service.imageUrl;
            return (
              <div
                key={service.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 rounded-xl hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 dark:border-zinc-700">
                    {photo ? (
                      <img src={photo} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <SegmentIcon iconName={currentPreset.icon} className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
                      {service.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                      {service.durationMinutes} min{photo ? ' · Com foto' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-zinc-800">
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-lg font-mono tabular-nums">
                    R$ {Number(service.price).toFixed(2)}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(service)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Editar serviço e foto"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteServiceId(service.id)}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-xl transition-colors"
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
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum(a) {currentPreset.terms.service.toLowerCase()} cadastrado(a) ainda.
              </p>
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-black dark:bg-[#D4AF37] text-white dark:text-black hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Cadastrar primeiro(a) {currentPreset.terms.service.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Modal: Cadastrar ou Editar Serviço */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-bold font-serif text-gray-900 dark:text-white truncate">
                  {editingService
                    ? `Editar ${currentPreset.terms.service}`
                    : `Novo(a) ${currentPreset.terms.service}`}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {editingService
                    ? `Atualizando "${editingService.name}"`
                    : 'Preencha os dados para adicionar ao catálogo'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting || uploadingImage}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                aria-label="Fechar janela"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* Foto ilustrativa */}
                <div className="flex items-center gap-4">
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
                    className="relative group w-16 h-16 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#D4AF37] cursor-pointer overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-zinc-800 transition-colors shrink-0"
                    title="Clique para enviar foto"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                    ) : modalForm.image_url ? (
                      <>
                        <img src={modalForm.image_url} alt="Foto" className="w-full h-full object-cover" />
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

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Foto do {currentPreset.terms.service.toLowerCase()} (opcional)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="text-xs font-semibold text-[#B8941F] dark:text-[#D4AF37] hover:underline"
                      >
                        {modalForm.image_url ? 'Trocar imagem' : 'Enviar imagem'}
                      </button>
                      {modalForm.image_url && (
                        <button
                          type="button"
                          onClick={() => setModalForm((prev) => ({ ...prev, image_url: '' }))}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                    Nome do(a) {currentPreset.terms.service.toLowerCase()} *
                  </label>
                  <input
                    type="text"
                    required
                    value={modalForm.name}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={`Ex: ${currentPreset.suggestedServices?.[0]?.name || 'Procedimento completo'}`}
                    className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl px-3.5 py-3 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Duração e Valor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                      Duração (minutos) *
                    </label>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      required
                      value={modalForm.duration}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, duration: e.target.value }))}
                      placeholder="30"
                      className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl px-3.5 py-3 text-sm outline-none focus:border-[#D4AF37] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                      Valor (R$) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={modalForm.price}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="50.00"
                      className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl px-3.5 py-3 text-sm font-bold outline-none focus:border-[#D4AF37] tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 bg-gray-50 dark:bg-zinc-950/60 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting || uploadingImage}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingImage || !modalForm.name.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-black dark:bg-[#D4AF37] text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Salvando...'
                    : editingService
                    ? 'Salvar Alterações'
                    : `Cadastrar ${currentPreset.terms.service}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
