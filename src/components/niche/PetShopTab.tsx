import React, { useState, useEffect } from 'react';
import { Dog, Plus, Trash2, Heart, AlertCircle, MessageCircle, Sparkles, Check, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface PetShopTabProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
}

const TEMPERAMENTS = ['Dócil & Calmo', 'Brincalhão / Agitado', 'Tímido / Assustado', 'Bravo / Morde', 'Idoso / Frágil'];
const SIZES = ['Pequeno (Até 10kg)', 'Médio (11 a 20kg)', 'Grande (21 a 40kg)', 'Gigante (+40kg)'];
const COAT_TYPES = ['Pelo Curto', 'Pelo Longo', 'Encaracolado / Poodle', 'Dupla Pelagem', 'Subpelo Denso'];

export default function PetShopTab({ clientId, clientName, clientPhone }: PetShopTabProps) {
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState('Cão');
  const [breed, setBreed] = useState('');
  const [size, setSize] = useState('Pequeno (Até 10kg)');
  const [coatType, setCoatType] = useState('Pelo Curto');
  const [birthYear, setBirthYear] = useState('');
  const [temperament, setTemperament] = useState('Dócil & Calmo');
  const [allergiesMedical, setAllergiesMedical] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const fetchPets = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/pets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPets(data.pets || []);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar pets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, [clientId]);

  const handleSavePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) {
      toast.error('Informe o nome do pet');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/pets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pet_name: petName.trim(),
          species,
          breed: breed.trim(),
          size,
          coat_type: coatType,
          birth_year: birthYear.trim(),
          temperament,
          allergies_medical: allergiesMedical.trim(),
          special_instructions: specialInstructions.trim()
        })
      });

      if (!res.ok) throw new Error('Erro ao salvar pet');
      toast.success('Pet cadastrado com sucesso!');
      setIsFormOpen(false);
      // Reset form
      setPetName('');
      setBreed('');
      setBirthYear('');
      setAllergiesMedical('');
      setSpecialInstructions('');
      fetchPets();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar pet');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePet = async (petId: string, name: string) => {
    if (!window.confirm(`Deseja remover o cadastro do pet "${name}"?`)) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/pets/${petId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir pet');
      toast.success('Pet removido com sucesso!');
      fetchPets();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover pet');
    }
  };

  const sendWhatsAppPetReady = (pet: any) => {
    if (!clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá, ${clientName}! 🐾\n\nPassando para avisar que o(a) *${pet.pet_name}* acabou de finalizar o banho e tosa e já está cheiroso(a), escovado(a) e pronto(a) para ser buscado(a)! ❤️🐶`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-sky-50 dark:bg-sky-950/20 p-5 rounded-2xl border border-sky-200 dark:border-sky-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Dog className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              Pets Cadastrados de {clientName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Gerencie temperamento, cuidados com pelagem, alergias e envie avisos de "Pet Pronto".
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl shadow-md transition-all self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Pet</span>
        </button>
      </div>

      {/* Form to Register Pet */}
      {isFormOpen && (
        <form onSubmit={handleSavePet} className="bg-white dark:bg-zinc-900 border border-sky-300 dark:border-sky-800/50 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" />
              Novo Pet para {clientName}
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
                Nome do Pet *
              </label>
              <input
                type="text"
                required
                value={petName}
                onChange={e => setPetName(e.target.value)}
                placeholder="Ex: Thor, Mel, Bob"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Espécie
              </label>
              <select
                value={species}
                onChange={e => setSpecies(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="Cão">Cão 🐶</option>
                <option value="Gato">Gato 🐱</option>
                <option value="Ave">Ave 🦜</option>
                <option value="Outro">Outro 🐾</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Raça
              </label>
              <input
                type="text"
                value={breed}
                onChange={e => setBreed(e.target.value)}
                placeholder="Ex: Shih Tzu, Golden, SRD"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Porte
              </label>
              <select
                value={size}
                onChange={e => setSize(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Pelagem
              </label>
              <select
                value={coatType}
                onChange={e => setCoatType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {COAT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Temperamento
              </label>
              <select
                value={temperament}
                onChange={e => setTemperament(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {TEMPERAMENTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Idade / Ano Nasc.
              </label>
              <input
                type="text"
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                placeholder="Ex: 2 anos (2022)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Alergias e Condições Médicas (Shampoo especial, problemas de pele, otite)
              </label>
              <textarea
                rows={2}
                value={allergiesMedical}
                onChange={e => setAllergiesMedical(e.target.value)}
                placeholder="Ex: Usar shampoo hipoalergênico, pele sensível, histórico de otite no ouvido esquerdo."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Instruções Especiais de Manejo (Corte de unha, secador, focinheira)
              </label>
              <textarea
                rows={2}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Ex: Fica agitado com soprador quente, usar algodão nas orelhas, não cortar unhas muito curtas."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none resize-none"
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
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl shadow-md disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Cadastro do Pet'}
            </button>
          </div>
        </form>
      )}

      {/* Pet Cards List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Carregando dados dos pets...</div>
      ) : pets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8">
          <Dog className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Nenhum pet cadastrado para este tutor</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Cadastre os pets para manter histórico de raça, cuidados especiais, shampoo medicamentoso e enviar aviso de término no WhatsApp.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 px-4 py-2 bg-sky-600 text-white font-medium text-xs rounded-xl shadow hover:bg-sky-500"
          >
            Cadastrar Primeiro Pet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pets.map(pet => (
            <div
              key={pet.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:border-sky-400 dark:hover:border-sky-600 transition-all flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-lg">
                      {pet.species === 'Gato' ? '🐱' : '🐶'}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                        {pet.pet_name}
                        {pet.breed && <span className="text-xs font-normal text-gray-500">({pet.breed})</span>}
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        {pet.size} • {pet.coat_type} {pet.birth_year ? `• ${pet.birth_year}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeletePet(pet.id, pet.pet_name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                    title="Remover pet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mt-3.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40 font-medium">
                    {pet.temperament || 'Dócil'}
                  </span>
                  {pet.allergies_medical && (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      Atenção Médica
                    </span>
                  )}
                </div>

                {/* Details */}
                {(pet.allergies_medical || pet.special_instructions) && (
                  <div className="mt-3 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl text-xs space-y-1.5">
                    {pet.allergies_medical && (
                      <p className="text-gray-600 dark:text-gray-300">
                        <strong className="text-gray-800 dark:text-gray-200">Alergias / Pele:</strong> {pet.allergies_medical}
                      </p>
                    )}
                    {pet.special_instructions && (
                      <p className="text-gray-600 dark:text-gray-300">
                        <strong className="text-gray-800 dark:text-gray-200">Manejo:</strong> {pet.special_instructions}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* WhatsApp Pet Ready Button */}
              <button
                onClick={() => sendWhatsAppPetReady(pet)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Avisar no WhatsApp: {pet.pet_name} está pronto! 🐾</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
