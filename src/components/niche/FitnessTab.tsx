import React, { useState, useEffect } from 'react';
import { Dumbbell, Plus, Trash2, Activity, Sparkles, TrendingUp, AlertCircle, FileText, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface FitnessTabProps {
  clientId: string;
  clientName: string;
}

export default function FitnessTab({ clientId, clientName }: FitnessTabProps) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [muscleMassKg, setMuscleMassKg] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [abdomenCm, setAbdomenCm] = useState('');
  const [hipsCm, setHipsCm] = useState('');
  const [armsCm, setArmsCm] = useState('');
  const [thighsCm, setThighsCm] = useState('');
  const [physicalRestrictions, setPhysicalRestrictions] = useState('');
  const [trainingGoal, setTrainingGoal] = useState('Hipertrofia & Força');
  const [workoutPrescription, setWorkoutPrescription] = useState('');
  const [notes, setNotes] = useState('');

  const fetchAssessments = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/fitness-assessments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssessments(data.assessments || []);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar avaliações físicas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [clientId]);

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/fitness-assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assessment_date: assessmentDate,
          weight_kg: weightKg ? Number(weightKg) : null,
          height_cm: heightCm ? Number(heightCm) : null,
          body_fat_pct: bodyFatPct ? Number(bodyFatPct) : null,
          muscle_mass_kg: muscleMassKg ? Number(muscleMassKg) : null,
          chest_cm: chestCm ? Number(chestCm) : null,
          waist_cm: waistCm ? Number(waistCm) : null,
          abdomen_cm: abdomenCm ? Number(abdomenCm) : null,
          hips_cm: hipsCm ? Number(hipsCm) : null,
          arms_cm: armsCm ? Number(armsCm) : null,
          thighs_cm: thighsCm ? Number(thighsCm) : null,
          physical_restrictions: physicalRestrictions.trim(),
          training_goal: trainingGoal,
          workout_prescription: workoutPrescription.trim(),
          notes: notes.trim()
        })
      });

      if (!res.ok) throw new Error('Erro ao salvar avaliação física');
      toast.success('Avaliação física registrada com sucesso!');
      setIsFormOpen(false);
      // Reset
      setWeightKg('');
      setBodyFatPct('');
      setMuscleMassKg('');
      setChestCm('');
      setWaistCm('');
      setAbdomenCm('');
      setHipsCm('');
      setArmsCm('');
      setThighsCm('');
      setWorkoutPrescription('');
      setNotes('');
      fetchAssessments();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar avaliação');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!window.confirm('Deseja excluir esta avaliação física?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/fitness-assessments/${assessmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir avaliação');
      toast.success('Avaliação excluída!');
      fetchAssessments();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-orange-50 dark:bg-orange-950/20 p-5 rounded-2xl border border-orange-200 dark:border-orange-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              Avaliação Física & Treinos de {clientName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Antropometria, % de gordura, histórico de medidas corporais, restrições e prescrição de treino.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs rounded-xl shadow-md transition-all self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Avaliação Física</span>
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <form onSubmit={handleSaveAssessment} className="bg-white dark:bg-zinc-900 border border-orange-300 dark:border-orange-800/50 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Registro de Avaliação Antropométrica
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Data da Avaliação *
              </label>
              <input
                type="date"
                required
                value={assessmentDate}
                onChange={e => setAssessmentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Peso Atual (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                placeholder="Ex: 75.5"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Altura (cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                placeholder="Ex: 175"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Gordura Corporal (% BF)
              </label>
              <input
                type="number"
                step="0.1"
                value={bodyFatPct}
                onChange={e => setBodyFatPct(e.target.value)}
                placeholder="Ex: 16.5"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>

          {/* Medidas Corporais */}
          <div className="bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-xl space-y-3">
            <h5 className="font-bold text-xs uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Circunferências / Perímetros (cm)
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Tórax</label>
                <input
                  type="number"
                  step="0.1"
                  value={chestCm}
                  onChange={e => setChestCm(e.target.value)}
                  placeholder="98"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Cintura</label>
                <input
                  type="number"
                  step="0.1"
                  value={waistCm}
                  onChange={e => setWaistCm(e.target.value)}
                  placeholder="80"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Abdômen</label>
                <input
                  type="number"
                  step="0.1"
                  value={abdomenCm}
                  onChange={e => setAbdomenCm(e.target.value)}
                  placeholder="85"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Quadril</label>
                <input
                  type="number"
                  step="0.1"
                  value={hipsCm}
                  onChange={e => setHipsCm(e.target.value)}
                  placeholder="100"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Braço</label>
                <input
                  type="number"
                  step="0.1"
                  value={armsCm}
                  onChange={e => setArmsCm(e.target.value)}
                  placeholder="36"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Coxa</label>
                <input
                  type="number"
                  step="0.1"
                  value={thighsCm}
                  onChange={e => setThighsCm(e.target.value)}
                  placeholder="58"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Restrições / Lesões / Articulações (Hérnias, dores no joelho, ombro)
              </label>
              <textarea
                rows={2}
                value={physicalRestrictions}
                onChange={e => setPhysicalRestrictions(e.target.value)}
                placeholder="Ex: Hérnia discal L4-L5, evitar carga axial excessiva; dor no ombro direito em desenvolvimento."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Prescrição de Treino / Divisão de Ficha (Treino A/B/C ou Pilates)
              </label>
              <textarea
                rows={2}
                value={workoutPrescription}
                onChange={e => setWorkoutPrescription(e.target.value)}
                placeholder="Ex: Treino A: Peitoral e Tríceps (4x10). Treino B: Dorsal e Bíceps. Fortalecimento de Core no Reformer."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none resize-none"
              />
            </div>
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
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs rounded-xl shadow-md disabled:opacity-50"
            >
              {saving ? 'Registrando...' : 'Salvar Avaliação Física'}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Carregando avaliações...</div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8">
          <Dumbbell className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Nenhuma avaliação física registrada</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Registre a primeira avaliação antropométrica para acompanhar evolução de peso, gordura e medidas corporais.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 px-4 py-2 bg-orange-600 text-white font-medium text-xs rounded-xl shadow hover:bg-orange-500"
          >
            Registrar Primeira Avaliação
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {assessments.map(a => (
            <div
              key={a.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    Avaliação em {new Date(`${a.assessment_date}T12:00:00Z`).toLocaleDateString('pt-BR')}
                  </span>
                  {a.training_goal && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-medium">
                      {a.training_goal}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteAssessment(a.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                  title="Excluir avaliação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Stats Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Peso Corporal</span>
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {a.weight_kg ? `${a.weight_kg} kg` : 'N/I'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">% Gordura (BF)</span>
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {a.body_fat_pct ? `${a.body_fat_pct}%` : 'N/I'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Estatura</span>
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {a.height_cm ? `${a.height_cm} cm` : 'N/I'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Cintura / Abdômen</span>
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {a.waist_cm ? `${a.waist_cm} cm` : 'N/I'}
                  </span>
                </div>
              </div>

              {/* Medidas Grid */}
              <div className="text-xs bg-gray-50 dark:bg-zinc-800/40 p-3.5 rounded-xl grid grid-cols-2 sm:grid-cols-6 gap-2 text-gray-600 dark:text-gray-300">
                <div><strong>Tórax:</strong> {a.chest_cm ? `${a.chest_cm} cm` : '-'}</div>
                <div><strong>Cintura:</strong> {a.waist_cm ? `${a.waist_cm} cm` : '-'}</div>
                <div><strong>Abdômen:</strong> {a.abdomen_cm ? `${a.abdomen_cm} cm` : '-'}</div>
                <div><strong>Quadril:</strong> {a.hips_cm ? `${a.hips_cm} cm` : '-'}</div>
                <div><strong>Braço:</strong> {a.arms_cm ? `${a.arms_cm} cm` : '-'}</div>
                <div><strong>Coxa:</strong> {a.thighs_cm ? `${a.thighs_cm} cm` : '-'}</div>
              </div>

              {/* Restrições e Prescrição */}
              {(a.physical_restrictions || a.workout_prescription) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {a.physical_restrictions && (
                    <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 p-3 rounded-xl">
                      <strong className="text-red-700 dark:text-red-400 block mb-1">Restrições / Lesões:</strong>
                      <p className="text-gray-700 dark:text-gray-300">{a.physical_restrictions}</p>
                    </div>
                  )}
                  {a.workout_prescription && (
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 p-3 rounded-xl">
                      <strong className="text-blue-700 dark:text-blue-400 block mb-1">Prescrição do Treino:</strong>
                      <p className="text-gray-700 dark:text-gray-300">{a.workout_prescription}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
