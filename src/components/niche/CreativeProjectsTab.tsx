import React, { useState, useEffect } from 'react';
import {
  Hammer,
  Compass,
  Camera,
  Video,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  MapPin,
  Layers,
  MessageCircle,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../ConfirmModal';

interface CreativeProjectsTabProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
  segment: string;
}

interface SegmentFieldConfig {
  badgeTitle: string;
  badgeSubtitle: string;
  buttonLabel: string;
  formTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  scopeLabel: string;
  scopePlaceholder: string;
  specsLabel: string;
  specsPlaceholder: string;
  deliveryLabel: string;
  linkLabel: string;
  linkPlaceholder: string;
  statusOptions: string[];
  accentBg: string;
  accentBorder: string;
  accentBtn: string;
}

function getConfig(segment: string): SegmentFieldConfig {
  if (segment === 'woodwork') {
    return {
      badgeTitle: 'Projetos de Marcenaria Sob Medida',
      badgeSubtitle: 'Controle de ambientes, medidas, chapas de MDF, ferragens e montagem.',
      buttonLabel: 'Novo Móvel / Projeto',
      formTitle: 'Cadastrar Projeto de Marcenaria',
      titleLabel: 'Nome do Móvel / Ambiente *',
      titlePlaceholder: 'Ex: Cozinha Planejada & Ilha Gourmet',
      categoryLabel: 'Acabamento / Padrão MDF',
      categoryPlaceholder: 'Ex: MDF Freijó + Branco Tx 18mm',
      locationLabel: 'Ambiente / Endereço da Obra',
      locationPlaceholder: 'Ex: Apartamento 402 - Cozinha',
      scopeLabel: 'Medidas / Metragem',
      scopePlaceholder: 'Ex: 4,20m x 2,60m (pé-direito 2,75m)',
      specsLabel: 'Ferragens & Detalhes Técnicos',
      specsPlaceholder: 'Ex: Corrediças telescópicas amortecidas, dobradiças slow, fita LED',
      deliveryLabel: 'Previsão de Entrega / Montagem',
      linkLabel: 'Link do Projeto 3D / Orçamento',
      linkPlaceholder: 'https://drive.google.com/...',
      statusOptions: ['Briefing / Medição', 'Em Produção na Marcenaria', 'Aguardando Montagem', 'Montado & Entregue'],
      accentBg: 'bg-amber-50 dark:bg-amber-950/20',
      accentBorder: 'border-amber-200 dark:border-amber-800/40',
      accentBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
    };
  }

  if (segment === 'architecture') {
    return {
      badgeTitle: 'Projetos & Acompanhamento de Obra',
      badgeSubtitle: 'Metragem (m²), fases executivas, RRT/ART e pranchas para o cliente.',
      buttonLabel: 'Novo Projeto / Obra',
      formTitle: 'Cadastrar Projeto Arquitetônico',
      titleLabel: 'Título do Projeto *',
      titlePlaceholder: 'Ex: Reforma Residencial Vila Nova',
      categoryLabel: 'Tipo / Escopo',
      categoryPlaceholder: 'Ex: Projeto Executivo + Interiores',
      locationLabel: 'Endereço do Imóvel / Obra',
      locationPlaceholder: 'Ex: Rua das Palmeiras, 180',
      scopeLabel: 'Área Total (m²)',
      scopePlaceholder: 'Ex: 145 m²',
      specsLabel: 'RRT / Especificações & Materiais',
      specsPlaceholder: 'Ex: RRT nº 123456, porcelanato acetinado, marcenaria integrada',
      deliveryLabel: 'Previsão da Etapa / Entrega',
      linkLabel: 'Link das Pranchas / Pasta Drive',
      linkPlaceholder: 'https://drive.google.com/...',
      statusOptions: ['Estudo Preliminar', 'Anteprojeto / 3D', 'Projeto Executivo', 'Em Obra / Acompanhamento', 'Concluído'],
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/20',
      accentBorder: 'border-emerald-200 dark:border-emerald-800/40',
      accentBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
    };
  }

  if (segment === 'video_production') {
    return {
      badgeTitle: 'Produções Audiovisuais & Entregas',
      badgeSubtitle: 'Briefing de gravação, set/locação, formato dos vídeos e link de aprovação.',
      buttonLabel: 'Nova Produção / Vídeo',
      formTitle: 'Cadastrar Produção Audiovisual',
      titleLabel: 'Título da Produção *',
      titlePlaceholder: 'Ex: Filme Institucional + 4 Reels',
      categoryLabel: 'Formato / Estilo',
      categoryPlaceholder: 'Ex: 4K Vertical + Horizontal',
      locationLabel: 'Locação / Set de Gravação',
      locationPlaceholder: 'Ex: Sede da Empresa / Estúdio',
      scopeLabel: 'Duração / Diária & Entregáveis',
      scopePlaceholder: 'Ex: Diária 8h • 1 vídeo 2min + 4 Reels',
      specsLabel: 'Captação, Áudio & Equipamentos',
      specsPlaceholder: 'Ex: 2 câmeras 4K, drone, lapela dupla, iluminação LED',
      deliveryLabel: 'Prazo de Edição / Entrega',
      linkLabel: 'Link do Vídeo / Drive / Frame.io',
      linkPlaceholder: 'https://drive.google.com/...',
      statusOptions: ['Briefing / Roteiro', 'Agendado / Captação', 'Em Edição / Color', 'Revisão do Cliente', 'Entregue'],
      accentBg: 'bg-rose-50 dark:bg-rose-950/20',
      accentBorder: 'border-rose-200 dark:border-rose-800/40',
      accentBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
    };
  }

  // photography (default)
  return {
    badgeTitle: 'Ensaios Fotográficos & Galerias',
    badgeSubtitle: 'Briefing do ensaio, locação, pacote de fotos e link da galeria final.',
    buttonLabel: 'Novo Ensaio / Cobertura',
    formTitle: 'Cadastrar Ensaio ou Cobertura',
    titleLabel: 'Título do Ensaio / Evento *',
    titlePlaceholder: 'Ex: Ensaio Gestante Golden Hour',
    categoryLabel: 'Estilo / Pacote',
    categoryPlaceholder: 'Ex: Externo + 50 fotos tratadas',
    locationLabel: 'Locação do Ensaio',
    locationPlaceholder: 'Ex: Parque / Estúdio Interno',
    scopeLabel: 'Duração & Quantidade de Fotos',
    scopePlaceholder: 'Ex: 2h de ensaio • 60 fotos editadas',
    specsLabel: 'Looks, Briefing & Equipamento',
    specsPlaceholder: 'Ex: 3 trocas de roupa, luz natural, lente 50mm/85mm',
    deliveryLabel: 'Data Prevista da Galeria',
    linkLabel: 'Link da Galeria / Seleção',
    linkPlaceholder: 'https://pixieset.com/... ou Drive',
    statusOptions: ['Briefing / Agendado', 'Clicado / Seleção', 'Em Tratamento / Edição', 'Galeria Entregue'],
    accentBg: 'bg-violet-50 dark:bg-violet-950/20',
    accentBorder: 'border-violet-200 dark:border-violet-800/40',
    accentBtn: 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/20'
  };
}

function SegmentBadgeIcon({ segment, className }: { segment: string; className?: string }) {
  if (segment === 'woodwork') return <Hammer className={className} />;
  if (segment === 'architecture') return <Compass className={className} />;
  if (segment === 'video_production') return <Video className={className} />;
  return <Camera className={className} />;
}

export default function CreativeProjectsTab({
  clientId,
  clientName,
  clientPhone,
  segment
}: CreativeProjectsTabProps) {
  const cfg = getConfig(segment);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    project_title: '',
    category_or_style: '',
    location_or_room: '',
    dimensions_or_scope: '',
    materials_or_specs: '',
    status: cfg.statusOptions[0],
    delivery_date: '',
    deliverable_link: '',
    estimated_value: '',
    notes: ''
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, status: cfg.statusOptions[0] }));
  }, [segment]);

  const fetchProjects = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/creative-projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      toast.error('Erro ao buscar projetos do cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [clientId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_title.trim()) {
      toast.error('Informe o título do projeto.');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/creative-projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          segment_type: segment
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      toast.success('Projeto registrado com sucesso!');
      setIsFormOpen(false);
      setForm({
        project_title: '',
        category_or_style: '',
        location_or_room: '',
        dimensions_or_scope: '',
        materials_or_specs: '',
        status: cfg.statusOptions[0],
        delivery_date: '',
        deliverable_link: '',
        estimated_value: '',
        notes: ''
      });
      fetchProjects();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar projeto.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/creative-projects/${projectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      toast.success('Status atualizado!');
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p)));
    } catch {
      toast.error('Não foi possível atualizar o status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/creative-projects/${deleteTargetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Projeto removido com sucesso!');
      setDeleteTargetId(null);
      fetchProjects();
    } catch {
      toast.error('Erro ao excluir projeto.');
    } finally {
      setDeleting(false);
    }
  };

  const buildWhatsAppLink = (proj: any) => {
    const cleanPhone = String(clientPhone || '').replace(/\D/g, '');
    if (!cleanPhone) return null;
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const lines = [
      `Olá, ${clientName}!`,
      `Atualização do seu projeto *"${proj.project_title}"*:`,
      `• Status atual: *${proj.status || cfg.statusOptions[0]}*`
    ];
    if (proj.delivery_date) {
      lines.push(`• Previsão de entrega: ${proj.delivery_date.split('-').reverse().join('/')}`);
    }
    if (proj.deliverable_link) {
      lines.push(`• Link de acesso: ${proj.deliverable_link}`);
    }
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border ${cfg.accentBg} ${cfg.accentBorder}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${cfg.accentBtn}`}>
            <SegmentBadgeIcon segment={segment} className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              {cfg.badgeTitle} — {clientName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {cfg.badgeSubtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-xs rounded-xl shadow-md transition-all self-stretch sm:self-auto justify-center ${cfg.accentBtn}`}
        >
          <Plus className="w-4 h-4" />
          <span>{cfg.buttonLabel}</span>
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <SegmentBadgeIcon segment={segment} className="w-4 h-4 text-amber-500" />
              {cfg.formTitle}
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {cfg.titleLabel}
              </label>
              <input
                type="text"
                required
                value={form.project_title}
                onChange={(e) => setForm({ ...form, project_title: e.target.value })}
                placeholder={cfg.titlePlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {cfg.categoryLabel}
              </label>
              <input
                type="text"
                value={form.category_or_style}
                onChange={(e) => setForm({ ...form, category_or_style: e.target.value })}
                placeholder={cfg.categoryPlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {cfg.locationLabel}
              </label>
              <input
                type="text"
                value={form.location_or_room}
                onChange={(e) => setForm({ ...form, location_or_room: e.target.value })}
                placeholder={cfg.locationPlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {cfg.scopeLabel}
              </label>
              <input
                type="text"
                value={form.dimensions_or_scope}
                onChange={(e) => setForm({ ...form, dimensions_or_scope: e.target.value })}
                placeholder={cfg.scopePlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {cfg.specsLabel}
              </label>
              <input
                type="text"
                value={form.materials_or_specs}
                onChange={(e) => setForm({ ...form, materials_or_specs: e.target.value })}
                placeholder={cfg.specsPlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Etapa / Status Atual
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none"
              >
                {cfg.statusOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {cfg.deliveryLabel}
                </label>
                <input
                  type="date"
                  value={form.delivery_date}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Valor Estimado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.estimated_value}
                  onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                  placeholder="0,00"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {cfg.linkLabel}
              </label>
              <input
                type="url"
                value={form.deliverable_link}
                onChange={(e) => setForm({ ...form, deliverable_link: e.target.value })}
                placeholder={cfg.linkPlaceholder}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Observações / Briefing do Cliente
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anotações importantes, preferências, restrições de acesso..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 ${cfg.accentBtn}`}
            >
              {saving ? 'Salvando...' : 'Salvar Registro'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Carregando projetos...</div>
      ) : projects.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
          <SegmentBadgeIcon segment={segment} className="w-8 h-8 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Nenhum projeto registrado para {clientName}.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Clique em "{cfg.buttonLabel}" acima para iniciar o histórico técnico.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((proj) => {
            const waHref = buildWhatsAppLink(proj);
            return (
              <div
                key={proj.id}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        {proj.project_title}
                      </h4>
                      {proj.category_or_style && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-medium">
                          {proj.category_or_style}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {proj.location_or_room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {proj.location_or_room}
                        </span>
                      )}
                      {proj.dimensions_or_scope && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {proj.dimensions_or_scope}
                        </span>
                      )}
                      {proj.delivery_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Entrega: {proj.delivery_date.split('-').reverse().join('/')}
                        </span>
                      )}
                      {proj.estimated_value !== null && proj.estimated_value !== undefined && (
                        <span className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          <DollarSign className="w-3.5 h-3.5" />
                          R$ {Number(proj.estimated_value).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <select
                      value={proj.status || cfg.statusOptions[0]}
                      onChange={(e) => handleStatusChange(proj.id, e.target.value)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 outline-none"
                    >
                      {cfg.statusOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(proj.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                      title="Excluir registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {proj.materials_or_specs && (
                  <div className="text-xs bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-xl text-gray-700 dark:text-gray-300">
                    <span className="font-bold text-[10px] text-gray-400 uppercase block mb-0.5">
                      Especificações Técnicas
                    </span>
                    {proj.materials_or_specs}
                  </div>
                )}

                {proj.notes && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {proj.notes}
                  </p>
                )}

                {(proj.deliverable_link || waHref) && (
                  <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap items-center gap-3">
                    {proj.deliverable_link && (
                      <a
                        href={proj.deliverable_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir Arquivo / Galeria
                      </a>
                    )}
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline ml-auto"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Enviar Atualização no WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTargetId)}
        title="Excluir registro do projeto?"
        description="Esta ação removerá permanentemente este projeto/ensaio da ficha do cliente."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTargetId(null)}
      />
    </div>
  );
}
