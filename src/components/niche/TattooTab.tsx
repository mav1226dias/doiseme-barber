import React, { useState, useEffect } from 'react';
import { PenTool, Plus, Trash2, ShieldCheck, Sparkles, MessageCircle, AlertCircle, Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TattooTabProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
}

const TATTOO_STYLES = [
  'Fineline / Delicada',
  'Old School / Tradicional',
  'Realismo Preto e Cinza',
  'Realismo Colorido',
  'Blackwork / Geométrico',
  'Oriental / Irezumi',
  'Lettering / Escrita',
  'Tribal / Maori',
  'Cobertura (Cover-up)',
  'Perfuração de Piercing (Titânio/Aço)'
];

const HEALING_STAGES = [
  'Recente / Curativo (1 a 3 dias)',
  'Em Descamação / Pomada (4 a 14 dias)',
  'Totalmente Cicatrizado (30+ dias)',
  'Necessita Retoque / Ajuste'
];

export default function TattooTab({ clientId, clientName, clientPhone }: TattooTabProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [placement, setPlacement] = useState('');
  const [style, setStyle] = useState('Fineline / Delicada');
  const [needleBatch, setNeedleBatch] = useState('');
  const [inkBatch, setInkBatch] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [healingStage, setHealingStage] = useState('Recente / Curativo (1 a 3 dias)');
  const [consentSigned, setConsentSigned] = useState(true);
  const [aftercareInstructions, setAftercareInstructions] = useState('Usar sabonete neutro 3x ao dia, camada fina de pomada cicatrizante e não expor ao sol/piscina.');
  const [notes, setNotes] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/tattoo-records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar registros de tattoo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [clientId]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !placement.trim()) {
      toast.error('Informe o título do projeto e o local do corpo');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/tattoo-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          placement: placement.trim(),
          style,
          needle_batch: needleBatch.trim(),
          ink_batch: inkBatch.trim(),
          session_date: sessionDate,
          healing_stage: healingStage,
          consent_signed: consentSigned ? 1 : 0,
          aftercare_instructions: aftercareInstructions.trim(),
          notes: notes.trim()
        })
      });

      if (!res.ok) throw new Error('Erro ao salvar registro');
      toast.success('Sessão registrada com sucesso!');
      setIsFormOpen(false);
      // Reset
      setTitle('');
      setPlacement('');
      setNeedleBatch('');
      setInkBatch('');
      setNotes('');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar sessão');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm('Deseja excluir este registro de tatuagem/piercing?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/tattoo-records/${recordId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Registro excluído com sucesso!');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const sendWhatsAppAftercare = (rec: any) => {
    if (!clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá, ${clientName}! 🖤💉\n\nSeguem as orientações de *Biossegurança e Cuidados Pós-Tatuagem* para sua arte *"${rec.title}"*:\n\n1. Lave delicadamente com sabonete neutro antibacteriano 3x ao dia;\n2. Seque com papel toalha (sem esfregar);\n3. Aplique uma camada bem fina de pomada cicatrizante;\n4. NÃO arranque casquinhas nem coce;\n5. Evite sol direto, praia e piscina por 20 dias.\n\nQualquer dúvida sobre a cicatrização estamos à disposição!`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-red-50 dark:bg-red-950/20 p-5 rounded-2xl border border-red-200 dark:border-red-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/20">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              Biossegurança & Artes de {clientName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Rastreabilidade de lotes de agulha e tinta Anvisa, termo de consentimento e acompanhamento de cicatrização.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium text-xs rounded-xl shadow-md transition-all self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nova Sessão / Arte</span>
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <form onSubmit={handleSaveRecord} className="bg-white dark:bg-zinc-900 border border-red-300 dark:border-red-800/50 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-500" />
              Nova Sessão de Tatuagem ou Piercing
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Título / Descrição da Arte *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Leão Geométrico, Frase no pulso"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Local do Corpo *
              </label>
              <input
                type="text"
                required
                value={placement}
                onChange={e => setPlacement(e.target.value)}
                placeholder="Ex: Antebraço direito, Costela, Coxa"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Estilo
              </label>
              <select
                value={style}
                onChange={e => setStyle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-red-500 outline-none"
              >
                {TATTOO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Data da Sessão
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Lote de Agulhas / Cartuchos (Anvisa)
              </label>
              <input
                type="text"
                value={needleBatch}
                onChange={e => setNeedleBatch(e.target.value)}
                placeholder="Ex: RL 03 Lote 24089 / Val 2027"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs font-mono focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Lote de Tintas / Pigmentos
              </label>
              <input
                type="text"
                value={inkBatch}
                onChange={e => setInkBatch(e.target.value)}
                placeholder="Ex: Electric Ink Preto Linha Lote 903"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs font-mono focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Estágio de Cicatrização
              </label>
              <select
                value={healingStage}
                onChange={e => setHealingStage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-red-500 outline-none"
              >
                {HEALING_STAGES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={consentSigned}
                  onChange={e => setConsentSigned(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                />
                <span>Termo de Consentimento Livre e Esclarecido (TCLE) assinado</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Observações Técnicas / Tempo de Agulha / Pigmentos Usados
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Sessão durou 2h30, pele respondeu muito bem sem inchaço excessivo. Usado preto tribal e cinza suave."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-medium text-xs rounded-xl shadow-md disabled:opacity-50"
            >
              {saving ? 'Registrando...' : 'Registrar Sessão'}
            </button>
          </div>
        </form>
      )}

      {/* Records List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Carregando registros de tatuagem...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8">
          <PenTool className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Nenhuma sessão registrada para este cliente</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Registre as artes para manter rastreabilidade dos lotes de agulha e tinta Anvisa e enviar guia de cuidados pós-tattoo no WhatsApp.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 px-4 py-2 bg-red-600 text-white font-medium text-xs rounded-xl shadow hover:bg-red-500"
          >
            Registrar Primeira Sessão
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(rec => (
            <div
              key={rec.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-red-300 dark:hover:border-red-900/60 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                    {rec.title}
                    <span className="text-xs font-normal text-gray-400">({rec.placement})</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40 font-medium">
                      {rec.style}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                      {rec.healing_stage}
                    </span>
                    {rec.consent_signed ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Termo TCLE Assinado
                      </span>
                    ) : (
                      <span className="text-amber-500 font-medium flex items-center gap-1 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Pendente TCLE
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteRecord(rec.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                    title="Excluir sessão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rastreabilidade Biossegurança Anvisa */}
              {(rec.needle_batch || rec.ink_batch) && (
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  {rec.needle_batch && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Lote Agulhas / Anvisa</span>
                        <span className="text-gray-800 dark:text-gray-200">{rec.needle_batch}</span>
                      </div>
                    </div>
                  )}
                  {rec.ink_batch && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Lote Pigmentos / Tinta</span>
                        <span className="text-gray-800 dark:text-gray-200">{rec.ink_batch}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {rec.notes && (
                <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-zinc-800/30 p-2.5 rounded-xl">
                  <strong>Anotações:</strong> {rec.notes}
                </p>
              )}

              {/* WhatsApp Button */}
              <button
                onClick={() => sendWhatsAppAftercare(rec)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enviar Manual de Cuidados Pós-Tattoo no WhatsApp 🖤</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
