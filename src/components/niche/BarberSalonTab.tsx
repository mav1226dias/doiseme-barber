import React, { useState, useEffect } from 'react';
import { Scissors, Palette, Sparkles, Check, AlertCircle, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface BarberSalonTabProps {
  clientId: string;
  clientName: string;
}

const COMMON_CUT_STYLES = [
  'Degradê Americano (Fade Baixo)',
  'Mid Fade (Degradê Médio)',
  'High Fade (Degradê Alto)',
  'Taper Fade Clássico',
  'Corte Social na Tesoura',
  'Buzz Cut / Militar',
  'Pompadour Clássico',
  'Mullet Moderno',
  'Corte em Camadas Feminino',
  'Long Bob / Chanel'
];

const COMMON_BEARD_STYLES = [
  'Barba Desenhada & Alinhada com Navalha',
  'Barba Lenhador (Longa & Modelada)',
  'Barba Rala / Designer 3 Dias',
  'Cavanhaque Alinhado',
  'Barba Tradicional Sem Navalhete',
  'Rosto Totalmente Raspado (Gillette/Navalha)'
];

export default function BarberSalonTab({ clientId, clientName }: BarberSalonTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    hair_cut_style: 'Degradê Americano (Fade Baixo)',
    beard_style: 'Barba Desenhada & Alinhada com Navalha',
    blade_sizes: '',
    hair_color_formula: '',
    shampoo_preference: '',
    aftershave_allergies: '',
    notes: ''
  });

  const fetchPreferences = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/style-preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setForm({
            hair_cut_style: data.preferences.hair_cut_style || 'Degradê Americano (Fade Baixo)',
            beard_style: data.preferences.beard_style || 'Barba Desenhada & Alinhada com Navalha',
            blade_sizes: data.preferences.blade_sizes || '',
            hair_color_formula: data.preferences.hair_color_formula || '',
            shampoo_preference: data.preferences.shampoo_preference || '',
            aftershave_allergies: data.preferences.aftershave_allergies || '',
            notes: data.preferences.notes || ''
          });
        }
      }
    } catch (err: any) {
      toast.error('Erro ao buscar preferências de corte e coloração');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [clientId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/style-preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) throw new Error('Erro ao salvar preferências');
      toast.success('Preferências de corte e coloração atualizadas com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-gray-400">Carregando preferências de estilo...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 p-5 rounded-2xl border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shadow-md font-bold">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              Ficha de Estilo & Coloração: {clientName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Guarde a altura exata dos pentes, estilo de fade, fórmula química de mechas/tintura e sensibilidades a lâmina.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-md transition-all self-stretch sm:self-auto justify-center disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Corte & Pentes */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Corte & Configuração das Lâminas
          </h4>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Estilo de Corte Habitual
            </label>
            <input
              type="text"
              list="cutStylesList"
              value={form.hair_cut_style}
              onChange={e => setForm({ ...form, hair_cut_style: e.target.value })}
              placeholder="Selecione ou digite o corte"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <datalist id="cutStylesList">
              {COMMON_CUT_STYLES.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Numeração de Lâminas / Pentes de Máquina
            </label>
            <input
              type="text"
              value={form.blade_sizes}
              onChange={e => setForm({ ...form, blade_sizes: e.target.value })}
              placeholder="Ex: 0 na costeleta, 1.5 alta na lateral, topo na tesoura 3 dedos"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <span className="text-[10px] text-gray-400 mt-1 block">
              Dica: Anote a graduação exata para qualquer barbeiro da equipe manter a fidelidade do corte.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Estilo e Acabamento da Barba
            </label>
            <input
              type="text"
              list="beardStylesList"
              value={form.beard_style}
              onChange={e => setForm({ ...form, beard_style: e.target.value })}
              placeholder="Selecione ou digite o estilo de barba"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
            <datalist id="beardStylesList">
              {COMMON_BEARD_STYLES.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
        </div>

        {/* Coloração & Sensibilidades */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Fórmula de Coloração & Cuidados
          </h4>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Fórmula Química de Coloração / Mechas / Matização
            </label>
            <textarea
              rows={3}
              value={form.hair_color_formula}
              onChange={e => setForm({ ...form, hair_color_formula: e.target.value })}
              placeholder="Ex: 60g Tinta 7.1 + 90ml Emulsão 20vol (1:1.5). Tempo de pausa: 35 minutos. Matizador pérola."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Sensibilidade a Navalha / Foliculite / Alergias
            </label>
            <input
              type="text"
              value={form.aftershave_allergies}
              onChange={e => setForm({ ...form, aftershave_allergies: e.target.value })}
              placeholder="Ex: Pele sensível na nuca, não usar pós-barba com álcool, usar lâmina nova"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Preferência de Lavagem & Finalizadores
            </label>
            <input
              type="text"
              value={form.shampoo_preference}
              onChange={e => setForm({ ...form, shampoo_preference: e.target.value })}
              placeholder="Ex: Shampoo mentolado refrescante, pomada efeito matte sem brilho"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Observações Gerais */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-2">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Anotações Técnicas Gerais do Profissional
        </label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Ex: Cliente prefere que não use secador muito quente. Redemoinho no lado direito da nuca."
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Salvando...' : 'Salvar Preferências'}</span>
        </button>
      </div>
    </form>
  );
}
