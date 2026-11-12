import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Brain, Calendar, Clock, FileText, Plus, Trash2, Edit3, 
  Printer, ShieldCheck, Heart, Sparkles, Check, AlertCircle, Phone, Search, Lock,
  Camera, Image as ImageIcon, RotateCcw, MessageCircle, ArrowRight, UserCheck, Eye,
  Dog, Car, Scissors, Dumbbell, PenTool
} from 'lucide-react';
import { toast } from 'sonner';

import PetShopTab from './niche/PetShopTab';
import VehiclesTab from './niche/VehiclesTab';
import BarberSalonTab from './niche/BarberSalonTab';
import FitnessTab from './niche/FitnessTab';
import TattooTab from './niche/TattooTab';

interface PatientRecordModalProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
  segment?: string;
  onClose: () => void;
}

const PSYCHOLOGY_MOOD_OPTIONS = [
  { label: 'Estável / Calmo', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { label: 'Ansioso', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { label: 'Depressivo / Desanimado', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { label: 'Reflexivo / Aberto', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  { label: 'Angustiado / Crise', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  { label: 'Agitado / Eufórico', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { label: 'Resistente / Retraído', color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' }
];

const FITZPATRICK_PHOTOTYPES = [
  { id: 'I', label: 'Fototipo I', desc: 'Pele muito clara, sempre queima, nunca bronzeia' },
  { id: 'II', label: 'Fototipo II', desc: 'Pele clara, queima facilmente, bronzeia minimamente' },
  { id: 'III', label: 'Fototipo III', desc: 'Pele morena clara, queima moderada, bronzeia gradualmente' },
  { id: 'IV', label: 'Fototipo IV', desc: 'Pele morena moderada, queima pouco, bronzeia com facilidade' },
  { id: 'V', label: 'Fototipo V', desc: 'Pele morena escura, raramente queima, bronzeia intensamente' },
  { id: 'VI', label: 'Fototipo VI', desc: 'Pele negra, nunca queima, alta pigmentação natural' },
];

const SKIN_TYPES = [
  'Normal', 'Seca / Desidratada', 'Mista', 'Oleosa / Acneica', 'Sensível / Com Rosácea'
];

const QUICK_TOUCHUP_PRESETS = [
  { name: 'Toxina Botulínica (Retoque)', days: 15 },
  { name: 'Toxina Botulínica (Nova Aplicação)', days: 150 },
  { name: 'Extensão de Cílios (Manutenção)', days: 20 },
  { name: 'Preenchimento Labial / Facial (Retoque)', days: 30 },
  { name: 'Limpeza de Pele Profunda (Retorno)', days: 35 },
  { name: 'Peeling / Microagulhamento (Próx. Sessão)', days: 28 },
];

export default function PatientRecordModal({
  clientId,
  clientName,
  clientPhone,
  segment = 'psychology',
  onClose
}: PatientRecordModalProps) {
  // Niche checks
  const isPetShop = segment === 'pet_shop' || segment === 'pet' || segment === 'petshop';
  const isAuto = segment === 'auto_detailing' || segment === 'auto' || segment === 'oficina';
  const isBarberOrSalon = segment === 'barbershop' || segment === 'barber' || segment === 'beauty_salon' || segment === 'woodwork';
  const isFitness = segment === 'personal_trainer' || segment === 'personal' || segment === 'pilates' || segment === 'nutrition';
  const isTattoo = segment === 'tattoo' || segment === 'tatuagem';
  const isAesthetics = segment === 'aesthetics' || segment === 'lash_design' || segment === 'makeup';
  const isPsychology = !isPetShop && !isAuto && !isBarberOrSalon && !isFitness && !isTattoo && !isAesthetics;

  const getInitialTab = () => {
    if (isPetShop) return 'pets';
    if (isAuto) return 'vehicles';
    if (isBarberOrSalon) return 'style_prefs';
    if (isFitness) return 'fitness';
    if (isTattoo) return 'tattoo';
    if (isAesthetics) return 'aesthetics_anamnesis';
    return 'notes';
  };

  // Tabs
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [loading, setLoading] = useState(true);

  // Psychology / General Notes & Anamnesis
  const [notes, setNotes] = useState<any[]>([]);
  const [anamnesis, setAnamnesis] = useState<any>({
    chief_complaint: '',
    history_of_problem: '',
    family_medical_history: '',
    current_medications: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: ''
  });
  const [appointments, setAppointments] = useState<any[]>([]);

  // Aesthetics Data
  const [aestheticsAnamnesis, setAestheticsAnamnesis] = useState<any>({
    skin_phototype: 'Fototipo III',
    skin_type: 'Mista',
    allergies: '',
    contraindications: '',
    main_complaints: '',
    home_care_routine: '',
    treatment_plan: '',
    notes: ''
  });
  const [photos, setPhotos] = useState<any[]>([]);
  const [touchups, setTouchups] = useState<any[]>([]);

  // Psychology Note form state
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    session_date: new Date().toISOString().split('T')[0],
    session_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    patient_mood: 'Estável / Calmo',
    therapeutic_goals: '',
    techniques_used: '',
    is_private: true
  });

  // Aesthetics Photo form state
  const [isPhotoFormOpen, setIsPhotoFormOpen] = useState(false);
  const [newPhotoProcedure, setNewPhotoProcedure] = useState('');
  const [newPhotoDate, setNewPhotoDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBeforeUrl, setNewBeforeUrl] = useState('');
  const [newAfterUrl, setNewAfterUrl] = useState('');
  const [newPhotoNotes, setNewPhotoNotes] = useState('');
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const beforeFileInputRef = useRef<HTMLInputElement>(null);
  const afterFileInputRef = useRef<HTMLInputElement>(null);

  // Aesthetics Touchup form state
  const [isTouchupFormOpen, setIsTouchupFormOpen] = useState(false);
  const [newTouchupProcedure, setNewTouchupProcedure] = useState('');
  const [newTouchupPerformedDate, setNewTouchupPerformedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTouchupDueDate, setNewTouchupDueDate] = useState('');
  const [newTouchupInterval, setNewTouchupInterval] = useState(15);
  const [newTouchupNotes, setNewTouchupNotes] = useState('');

  // Saving loaders
  const [savingNote, setSavingNote] = useState(false);
  const [savingAnamnesis, setSavingAnamnesis] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingTouchup, setSavingTouchup] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState('all');

  const fetchRecords = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      // 1. Fetch general/psychology records
      const res = await fetch(`/api/admin/clients/${clientId}/records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
        if (data.anamnesis) setAnamnesis(data.anamnesis);
        setAppointments(data.appointments || []);
      }

      // 2. Fetch aesthetics specialized data
      const aesRes = await fetch(`/api/admin/clients/${clientId}/aesthetics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (aesRes.ok) {
        const aesData = await aesRes.json();
        if (aesData.anamnesis) setAestheticsAnamnesis(aesData.anamnesis);
        setPhotos(aesData.photos || []);
        setTouchups(aesData.touchups || []);
      }
    } catch (err: any) {
      toast.error('Erro ao carregar prontuário');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [clientId]);

  // Handle Note Save (Psychology / General)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.title || !noteForm.content) {
      toast.error('Título e anotações da sessão são obrigatórios');
      return;
    }

    setSavingNote(true);
    const token = localStorage.getItem('token');
    try {
      const url = editingNoteId 
        ? `/api/admin/clients/${clientId}/notes/${editingNoteId}`
        : `/api/admin/clients/${clientId}/notes`;

      const method = editingNoteId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(noteForm)
      });

      if (!res.ok) throw new Error('Erro ao salvar anotação');

      toast.success(editingNoteId ? 'Evolução atualizada!' : 'Evolução registrada com sucesso!');
      setIsNoteFormOpen(false);
      setEditingNoteId(null);
      setNoteForm({
        title: '',
        content: '',
        session_date: new Date().toISOString().split('T')[0],
        session_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        patient_mood: 'Estável / Calmo',
        therapeutic_goals: '',
        techniques_used: '',
        is_private: true
      });
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar anotação');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta anotação do prontuário?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Anotação removida');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  // Handle Psychology Anamnesis Save
  const handleSavePsychologyAnamnesis = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnamnesis(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/anamnesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(anamnesis)
      });
      if (!res.ok) throw new Error('Erro ao salvar anamnese');
      toast.success('Ficha de Anamnese atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSavingAnamnesis(false);
    }
  };

  // Handle Aesthetics Anamnesis Save
  const handleSaveAestheticsAnamnesis = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnamnesis(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/aesthetics/anamnesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(aestheticsAnamnesis)
      });
      if (!res.ok) throw new Error('Erro ao salvar anamnese estética');
      toast.success('Ficha de Anamnese Facial/Corporal atualizada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar anamnese estética');
    } finally {
      setSavingAnamnesis(false);
    }
  };

  // Handle Image Upload for Before / After
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'before') setUploadingBefore(true);
    else setUploadingAfter(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const split = (reader.result as string).split(',');
          resolve(split[1]);
        };
        reader.readAsDataURL(file);
      });

      const base64Content = await base64Promise;
      const token = localStorage.getItem('token');
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `aesthetics/${clientId}/${type}-${Date.now()}.${fileExt}`;

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

      if (!res.ok) throw new Error('Falha no upload da foto');
      const { publicUrl } = await res.json();

      if (type === 'before') setNewBeforeUrl(publicUrl);
      else setNewAfterUrl(publicUrl);

      toast.success(`Foto do ${type === 'before' ? 'Antes' : 'Depois'} anexada com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar foto');
    } finally {
      if (type === 'before') setUploadingBefore(false);
      else setUploadingAfter(false);
    }
  };

  // Handle Save Photo Record
  const handleSavePhotoRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoProcedure) {
      toast.error('Informe o nome do procedimento realizado');
      return;
    }
    if (!newBeforeUrl && !newAfterUrl) {
      toast.error('Anexe pelo menos uma foto do Antes ou do Depois');
      return;
    }

    setSavingPhoto(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/aesthetics/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          procedure_name: newPhotoProcedure,
          date: newPhotoDate,
          before_photo_url: newBeforeUrl,
          after_photo_url: newAfterUrl,
          notes: newPhotoNotes
        })
      });

      if (!res.ok) throw new Error('Erro ao salvar registro de fotos');
      toast.success('Registro fotográfico salvo com sucesso!');
      setIsPhotoFormOpen(false);
      setNewPhotoProcedure('');
      setNewBeforeUrl('');
      setNewAfterUrl('');
      setNewPhotoNotes('');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar fotos');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleDeletePhotoRecord = async (photoId: string) => {
    if (!window.confirm('Deseja excluir este registro de fotos?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/aesthetics/photos/${photoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Registro de fotos excluído');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  // Handle Touchup Cycle Save
  const handleSaveTouchup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTouchupProcedure || !newTouchupDueDate) {
      toast.error('Preencha o procedimento e a data de retorno prevista');
      return;
    }

    setSavingTouchup(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/aesthetics/touchups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          procedure_name: newTouchupProcedure,
          performed_date: newTouchupPerformedDate,
          return_due_date: newTouchupDueDate,
          interval_days: newTouchupInterval,
          notes: newTouchupNotes
        })
      });

      if (!res.ok) throw new Error('Erro ao cadastrar ciclo de retoque');
      toast.success('Alerta de retorno cadastrado com sucesso!');
      setIsTouchupFormOpen(false);
      setNewTouchupProcedure('');
      setNewTouchupDueDate('');
      setNewTouchupNotes('');
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar retorno');
    } finally {
      setSavingTouchup(false);
    }
  };

  const handleUpdateTouchupStatus = async (id: string, status: 'pending' | 'contacted' | 'completed') => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/aesthetics/touchups/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      toast.success('Status atualizado!');
      fetchRecords();
    } catch (err: any) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDeleteTouchup = async (id: string) => {
    if (!window.confirm('Excluir este lembrete de retorno?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/aesthetics/touchups/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Retorno excluído');
      fetchRecords();
    } catch (err: any) {
      toast.error('Erro ao excluir');
    }
  };

  const applyTouchupPreset = (preset: { name: string; days: number }) => {
    setNewTouchupProcedure(preset.name);
    setNewTouchupInterval(preset.days);
    const date = new Date(newTouchupPerformedDate);
    date.setDate(date.getDate() + preset.days);
    setNewTouchupDueDate(date.toISOString().split('T')[0]);
  };

  const filteredNotes = notes.filter(n => {
    const matchesSearch = 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMood = selectedMoodFilter === 'all' || n.patient_mood === selectedMoodFilter;
    return matchesSearch && matchesMood;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-5xl h-[94vh] max-h-[880px] flex flex-col overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
        
        {/* Header Adaptado por Nicho */}
        <div className={`p-6 border-b border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
          isPetShop
            ? 'bg-gradient-to-r from-sky-50/70 via-sky-50/30 to-white dark:from-[#0a233b]/40 dark:via-zinc-900 dark:to-zinc-900'
            : isAuto
            ? 'bg-gradient-to-r from-sky-50/70 via-blue-50/30 to-white dark:from-[#0c223d]/40 dark:via-zinc-900 dark:to-zinc-900'
            : isBarberOrSalon
            ? 'bg-gradient-to-r from-amber-50/70 via-amber-50/30 to-white dark:from-[#261806]/40 dark:via-zinc-900 dark:to-zinc-900'
            : isFitness
            ? 'bg-gradient-to-r from-orange-50/70 via-orange-50/30 to-white dark:from-[#2d1204]/40 dark:via-zinc-900 dark:to-zinc-900'
            : isTattoo
            ? 'bg-gradient-to-r from-red-50/70 via-red-50/30 to-white dark:from-[#290a0a]/40 dark:via-zinc-900 dark:to-zinc-900'
            : isAesthetics 
            ? 'bg-gradient-to-r from-amber-50/70 via-rose-50/40 to-white dark:from-[#241713]/50 dark:via-zinc-900 dark:to-zinc-900' 
            : 'bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/40 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
              isPetShop
                ? 'bg-sky-500 text-white shadow-sky-500/20'
                : isAuto
                ? 'bg-sky-600 text-white shadow-sky-600/20'
                : isBarberOrSalon
                ? 'bg-amber-500 text-black shadow-amber-500/20'
                : isFitness
                ? 'bg-orange-500 text-white shadow-orange-500/20'
                : isTattoo
                ? 'bg-red-600 text-white shadow-red-600/20'
                : isAesthetics 
                ? 'bg-[#E0A98B] text-black shadow-[#E0A98B]/20' 
                : 'bg-indigo-600 text-white shadow-indigo-600/20'
            }`}>
              {isPetShop && <Dog className="w-6 h-6" />}
              {isAuto && <Car className="w-6 h-6" />}
              {isBarberOrSalon && <Scissors className="w-6 h-6" />}
              {isFitness && <Dumbbell className="w-6 h-6" />}
              {isTattoo && <PenTool className="w-6 h-6" />}
              {isAesthetics && <Sparkles className="w-6 h-6" />}
              {isPsychology && <Brain className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">
                  {isPetShop && `Ficha do Tutor & Pets: ${clientName}`}
                  {isAuto && `Ficha Veicular & O.S.: ${clientName}`}
                  {isBarberOrSalon && `Ficha de Estilo & Coloração: ${clientName}`}
                  {isFitness && `Avaliação Física & Treinos: ${clientName}`}
                  {isTattoo && `Biossegurança & Artes: ${clientName}`}
                  {isAesthetics && `Ficha Estética: ${clientName}`}
                  {isPsychology && `Prontuário Clínico: ${clientName}`}
                </h2>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isPetShop
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                    : isAuto
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                    : isBarberOrSalon
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : isFitness
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                    : isTattoo
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    : isAesthetics 
                    ? 'bg-[#E0A98B]/15 text-[#C47C62] dark:text-[#E0A98B] border-[#E0A98B]/30' 
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                }`}>
                  {isPetShop && <Dog className="w-3 h-3" />}
                  {isAuto && <Car className="w-3 h-3" />}
                  {isBarberOrSalon && <Scissors className="w-3 h-3" />}
                  {isFitness && <Dumbbell className="w-3 h-3" />}
                  {isTattoo && <ShieldCheck className="w-3 h-3" />}
                  {isAesthetics && <Sparkles className="w-3 h-3" />}
                  {isPsychology && <Lock className="w-3 h-3" />}

                  {isPetShop && 'Pet Shop & Cuidado Animal'}
                  {isAuto && 'Oficina & Car Detailing'}
                  {isBarberOrSalon && 'Barbearia & Salão Concept'}
                  {isFitness && 'Personal Trainer & Pilates'}
                  {isTattoo && 'Biossegurança Anvisa & Tattoo'}
                  {isAesthetics && 'Estética & Cuidados Avançados'}
                  {isPsychology && 'Sigilo Ético CFP'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-green-500" />
                  {clientPhone || 'Sem telefone'}
                </span>
                <span>•</span>
                <span>Registro Individualizado & Histórico Permanente</span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-all self-end sm:self-auto"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-zinc-800 px-6 bg-gray-50/50 dark:bg-zinc-900/50 gap-6 overflow-x-auto">
          {/* PET SHOP */}
          {isPetShop && (
            <>
              <button
                onClick={() => setActiveTab('pets')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'pets'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Dog className="w-4 h-4" />
                <span>Pets & Cuidados</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Histórico de Atendimentos ({notes.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Agendamentos na Agenda ({appointments.length})</span>
              </button>
            </>
          )}

          {/* AUTO DETAILING & OFICINA */}
          {isAuto && (
            <>
              <button
                onClick={() => setActiveTab('vehicles')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'vehicles'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Veículos & Ordens de Serviço</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Histórico & Checklist ({notes.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Agendamentos ({appointments.length})</span>
              </button>
            </>
          )}

          {/* BARBEARIA & SALÃO */}
          {isBarberOrSalon && (
            <>
              <button
                onClick={() => setActiveTab('style_prefs')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'style_prefs'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Scissors className="w-4 h-4" />
                <span>Preferências de Corte & Coloração</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Histórico & Procedimentos ({notes.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Agendamentos ({appointments.length})</span>
              </button>
            </>
          )}

          {/* FITNESS & PILATES & NUTRIÇÃO */}
          {isFitness && (
            <>
              <button
                onClick={() => setActiveTab('fitness')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'fitness'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Dumbbell className="w-4 h-4" />
                <span>Avaliação Física & Treinos</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Evolução & Metas ({notes.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Treinos Agendados ({appointments.length})</span>
              </button>
            </>
          )}

          {/* TATTOO & PIERCING */}
          {isTattoo && (
            <>
              <button
                onClick={() => setActiveTab('tattoo')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'tattoo'
                    ? 'border-red-600 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>Biossegurança & Artes</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-red-600 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Anotações das Sessões ({notes.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-red-600 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Sessões Agendadas ({appointments.length})</span>
              </button>
            </>
          )}

          {/* ESTÉTICA */}
          {isAesthetics && (
            <>
              <button
                onClick={() => setActiveTab('aesthetics_anamnesis')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'aesthetics_anamnesis'
                    ? 'border-[#E0A98B] text-[#C47C62] dark:text-[#E0A98B]'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Anamnese Facial & Corporal</span>
              </button>

              <button
                onClick={() => setActiveTab('photos')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'photos'
                    ? 'border-[#E0A98B] text-[#C47C62] dark:text-[#E0A98B]'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Fotos Antes & Depois ({photos.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('touchups')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'touchups'
                    ? 'border-[#E0A98B] text-[#C47C62] dark:text-[#E0A98B]'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ciclos de Retorno & Retoques ({touchups.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-[#E0A98B] text-[#C47C62] dark:text-[#E0A98B]'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Evoluções & Procedimentos ({notes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-[#E0A98B] text-[#C47C62] dark:text-[#E0A98B]'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Agenda ({appointments.length})</span>
              </button>
            </>
          )}

          {/* PSICOLOGIA (OU PADRÃO) */}
          {isPsychology && (
            <>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Evolução Clínica & Anotações ({notes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('anamnesis')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'anamnesis'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Brain className="w-4 h-4" />
                <span>Ficha de Anamnese</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`py-3.5 font-bold text-xs border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Consultas na Agenda ({appointments.length})</span>
              </button>
            </>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-zinc-950/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-2 border-[#E0A98B] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Carregando dados da ficha...</p>
            </div>
          ) : (
            <>
              {/* TAB NICHO 1: PET SHOP */}
              {activeTab === 'pets' && (
                <PetShopTab
                  clientId={clientId}
                  clientName={clientName}
                  clientPhone={clientPhone}
                />
              )}

              {/* TAB NICHO 2: OFICINA & ESTÉTICA AUTOMOTIVA */}
              {activeTab === 'vehicles' && (
                <VehiclesTab
                  clientId={clientId}
                  clientName={clientName}
                  clientPhone={clientPhone}
                />
              )}

              {/* TAB NICHO 3: BARBEARIA & SALÃO */}
              {activeTab === 'style_prefs' && (
                <BarberSalonTab
                  clientId={clientId}
                  clientName={clientName}
                />
              )}

              {/* TAB NICHO 4: FITNESS & PILATES & NUTRIÇÃO */}
              {activeTab === 'fitness' && (
                <FitnessTab
                  clientId={clientId}
                  clientName={clientName}
                />
              )}

              {/* TAB NICHO 5: TATTOO & PIERCING */}
              {activeTab === 'tattoo' && (
                <TattooTab
                  clientId={clientId}
                  clientName={clientName}
                  clientPhone={clientPhone}
                />
              )}

              {/* TAB ESTÉTICA 1: ANAMNESE FACIAL & CORPORAL */}
              {activeTab === 'aesthetics_anamnesis' && (
                <form onSubmit={handleSaveAestheticsAnamnesis} className="space-y-6 max-w-4xl mx-auto">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-zinc-800">
                      <Sparkles className="w-5 h-5 text-[#E0A98B]" />
                      <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-serif">
                          Anamnese Facial & Corporal Completa
                        </h3>
                        <p className="text-xs text-gray-500">Classificação de pele, contraindicações e rotina diária</p>
                      </div>
                    </div>

                    {/* Fototipo de Fitzpatrick */}
                    <div className="space-y-2">
                      <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]">
                        Fototipo Cutâneo (Classificação de Fitzpatrick)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {FITZPATRICK_PHOTOTYPES.map(photo => {
                          const isSelected = aestheticsAnamnesis.skin_phototype?.includes(photo.id);
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setAestheticsAnamnesis({ ...aestheticsAnamnesis, skin_phototype: photo.label })}
                              className={`p-3 rounded-2xl border text-left transition-all ${
                                isSelected
                                  ? 'bg-[#E0A98B]/15 border-[#E0A98B] text-gray-900 dark:text-white ring-1 ring-[#E0A98B]'
                                  : 'bg-gray-50 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700 hover:border-[#E0A98B]/50'
                              }`}
                            >
                              <div className="font-bold text-xs">{photo.label}</div>
                              <div className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-tight">{photo.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tipo de Pele */}
                    <div className="space-y-2">
                      <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]">
                        Tipo de Pele
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SKIN_TYPES.map(type => {
                          const isSelected = aestheticsAnamnesis.skin_type === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setAestheticsAnamnesis({ ...aestheticsAnamnesis, skin_type: type })}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                                isSelected
                                  ? 'bg-[#E0A98B] text-black border-[#E0A98B] shadow-sm'
                                  : 'bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-gray-400'
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Queixas e Contraindicações */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-1">
                          Queixas Principais (Motivo da Consulta)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Ex: Melasma nas maçãs do rosto, rugas dinâmicas na testa, flacidez mandibular, perda de volume labial..."
                          value={aestheticsAnamnesis.main_complaints || ''}
                          onChange={e => setAestheticsAnamnesis({ ...aestheticsAnamnesis, main_complaints: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:border-[#E0A98B] leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-1">
                          Alergias & Sensibilidades
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Ex: Alergia a iodo, esparadrapo/látex, lidocaína/anestésicos, ácidos com pH baixo, cosméticos com fragrância..."
                          value={aestheticsAnamnesis.allergies || ''}
                          onChange={e => setAestheticsAnamnesis({ ...aestheticsAnamnesis, allergies: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:border-[#E0A98B] leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Contraindicações Clínicas e Home Care */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-1">
                          Histórico Médico & Contraindicações
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Ex: Gestante/Lactante, histórico de queloide, marcapasso, uso de Roacutan nos últimos 6 meses, preenchedores prévios..."
                          value={aestheticsAnamnesis.contraindications || ''}
                          onChange={e => setAestheticsAnamnesis({ ...aestheticsAnamnesis, contraindications: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:border-[#E0A98B] leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-1">
                          Rotina de Home Care Atual (Uso em Casa)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Ex: Protetor solar FPS 50 diário, sabonete de ácido salicílico, sérum de vitamina C pela manhã, ácido noturno..."
                          value={aestheticsAnamnesis.home_care_routine || ''}
                          onChange={e => setAestheticsAnamnesis({ ...aestheticsAnamnesis, home_care_routine: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:border-[#E0A98B] leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Plano de Tratamento */}
                    <div className="text-xs">
                      <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-1">
                        Plano de Tratamento Estético & Recomendações
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Ex: Protocolo de 3 sessões de Peeling + 1 Toxina Botulínica. Orientado reforçar protetor solar a cada 3h e suspender ácidos 3 dias antes..."
                        value={aestheticsAnamnesis.treatment_plan || ''}
                        onChange={e => setAestheticsAnamnesis({ ...aestheticsAnamnesis, treatment_plan: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:border-[#E0A98B] leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingAnamnesis}
                        className="px-6 py-3 bg-[#E0A98B] hover:opacity-95 text-black font-bold rounded-xl text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingAnamnesis ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Salvar Anamnese Estética
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB ESTÉTICA 2: FOTOS ANTES & DEPOIS */}
              {activeTab === 'photos' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 font-serif flex items-center gap-2">
                        <Camera className="w-5 h-5 text-[#E0A98B]" />
                        Histórico Fotográfico (Antes & Depois)
                      </h3>
                      <p className="text-xs text-gray-500">Documentação visual da evolução dos procedimentos da cliente</p>
                    </div>

                    {!isPhotoFormOpen && (
                      <button
                        onClick={() => setIsPhotoFormOpen(true)}
                        className="flex items-center gap-2 bg-[#E0A98B] text-black px-4 py-2.5 rounded-xl font-bold text-xs shadow-md hover:opacity-90 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        Novo Registro Fotográfico
                      </button>
                    )}
                  </div>

                  {/* Form para Anexar Fotos */}
                  {isPhotoFormOpen && (
                    <div className="bg-white dark:bg-zinc-900 border-2 border-[#E0A98B]/30 rounded-3xl p-6 shadow-xl space-y-4 animate-in slide-in-from-top-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <Camera className="w-4 h-4 text-[#E0A98B]" /> Adicionar Fotos de Procedimento
                        </h4>
                        <button 
                          onClick={() => setIsPhotoFormOpen(false)}
                          className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                        >
                          Cancelar
                        </button>
                      </div>

                      <form onSubmit={handleSavePhotoRecord} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              Procedimento Realizado *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Toxina Botulínica, Preenchimento Labial, Peeling, Lash Volume Russo"
                              value={newPhotoProcedure}
                              onChange={e => setNewPhotoProcedure(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-[#E0A98B]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              Data do Registro *
                            </label>
                            <input
                              type="date"
                              required
                              value={newPhotoDate}
                              onChange={e => setNewPhotoDate(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none focus:border-[#E0A98B]"
                            />
                          </div>
                        </div>

                        {/* Duas Caixas de Upload (Antes e Depois) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {/* Foto ANTES */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                              1. Foto do ANTES
                            </span>
                            <div
                              onClick={() => beforeFileInputRef.current?.click()}
                              className="h-48 bg-gray-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-[#E0A98B] transition-all relative overflow-hidden group"
                            >
                              {uploadingBefore ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E0A98B] border-t-transparent" />
                              ) : newBeforeUrl ? (
                                <img src={newBeforeUrl} className="w-full h-full object-cover" alt="Antes" />
                              ) : (
                                <div className="text-center p-4">
                                  <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2 group-hover:text-[#E0A98B] transition-colors" />
                                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 block">Clique para enviar foto</span>
                                  <span className="text-[10px] text-gray-400">Antes do procedimento</span>
                                </div>
                              )}
                              <input 
                                type="file" 
                                ref={beforeFileInputRef} 
                                onChange={e => handleImageUpload(e, 'before')} 
                                className="hidden" 
                                accept="image/*" 
                              />
                            </div>
                          </div>

                          {/* Foto DEPOIS */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                              2. Foto do DEPOIS
                            </span>
                            <div
                              onClick={() => afterFileInputRef.current?.click()}
                              className="h-48 bg-gray-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-[#E0A98B] transition-all relative overflow-hidden group"
                            >
                              {uploadingAfter ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E0A98B] border-t-transparent" />
                              ) : newAfterUrl ? (
                                <img src={newAfterUrl} className="w-full h-full object-cover" alt="Depois" />
                              ) : (
                                <div className="text-center p-4">
                                  <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2 group-hover:text-[#E0A98B] transition-colors" />
                                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 block">Clique para enviar foto</span>
                                  <span className="text-[10px] text-gray-400">Resultado imediato ou retorno</span>
                                </div>
                              )}
                              <input 
                                type="file" 
                                ref={afterFileInputRef} 
                                onChange={e => handleImageUpload(e, 'after')} 
                                className="hidden" 
                                accept="image/*" 
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                            Observações do Resultado
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Ex: Assimetria corrigida, boa resposta tissular sem hematomas expressivos, agendado retorno em 15 dias..."
                            value={newPhotoNotes}
                            onChange={e => setNewPhotoNotes(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 text-xs outline-none focus:border-[#E0A98B]"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsPhotoFormOpen(false)}
                            className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingPhoto || uploadingBefore || uploadingAfter}
                            className="px-5 py-2 bg-[#E0A98B] text-black rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {savingPhoto ? 'Salvando...' : 'Salvar Comparativo'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Galeria de Comparativos Lado a Lado */}
                  <div className="space-y-6">
                    {photos.length === 0 ? (
                      <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl bg-white/50 dark:bg-zinc-900/50">
                        <Camera className="w-12 h-12 text-[#E0A98B] mx-auto mb-3 opacity-40" />
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                          Nenhum registro fotográfico anexado
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                          Adicione fotos do Antes e Depois para acompanhar os resultados estéticos da cliente ao longo do tempo.
                        </p>
                      </div>
                    ) : (
                      photos.map(record => (
                        <div 
                          key={record.id}
                          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-mono text-xs text-gray-400">
                                {new Date(record.date).toLocaleDateString('pt-BR')}
                              </span>
                              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 font-serif mt-0.5">
                                {record.procedure_name}
                              </h4>
                            </div>

                            <button
                              onClick={() => handleDeletePhotoRecord(record.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title="Excluir comparativo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Card Antes */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded-md inline-block">
                                ANTES
                              </span>
                              <div className="h-64 rounded-2xl overflow-hidden bg-zinc-950 border border-gray-100 dark:border-zinc-800">
                                {record.before_photo_url ? (
                                  <img src={record.before_photo_url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" alt="Antes" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xs text-gray-500">Sem foto do antes</div>
                                )}
                              </div>
                            </div>

                            {/* Card Depois */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47C62] dark:text-[#E0A98B] px-2 py-0.5 bg-[#E0A98B]/15 rounded-md inline-block">
                                DEPOIS / RESULTADO
                              </span>
                              <div className="h-64 rounded-2xl overflow-hidden bg-zinc-950 border border-gray-100 dark:border-zinc-800">
                                {record.after_photo_url ? (
                                  <img src={record.after_photo_url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" alt="Depois" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xs text-gray-500">Sem foto do depois</div>
                                )}
                              </div>
                            </div>
                          </div>

                          {record.notes && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 leading-relaxed">
                              {record.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB ESTÉTICA 3: CICLOS DE RETORNO & RETOQUES */}
              {activeTab === 'touchups' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 font-serif flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-[#E0A98B]" />
                        Ciclos de Retorno & Retoques
                      </h3>
                      <p className="text-xs text-gray-500">Monitore o prazo de retoque da Toxina, cílios, peelings e preenchimentos</p>
                    </div>

                    {!isTouchupFormOpen && (
                      <button
                        onClick={() => setIsTouchupFormOpen(true)}
                        className="flex items-center gap-2 bg-[#E0A98B] text-black px-4 py-2.5 rounded-xl font-bold text-xs shadow-md hover:opacity-90 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        Novo Alerta de Retorno
                      </button>
                    )}
                  </div>

                  {/* Form para Adicionar Retorno */}
                  {isTouchupFormOpen && (
                    <div className="bg-white dark:bg-zinc-900 border-2 border-[#E0A98B]/30 rounded-3xl p-6 shadow-xl space-y-4 animate-in slide-in-from-top-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                          Agendar Ciclo de Retoque / Manutenção
                        </h4>
                        <button onClick={() => setIsTouchupFormOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">
                          Cancelar
                        </button>
                      </div>

                      {/* Presets Rápidos em 1 Clique */}
                      <div>
                        <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">
                          Atalhos Rápidos de Procedimentos com Retorno:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_TOUCHUP_PRESETS.map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => applyTouchupPreset(p)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-[#E0A98B]/20 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 transition-colors"
                            >
                              {p.name} (+{p.days}d)
                            </button>
                          ))}
                        </div>
                      </div>

                      <form onSubmit={handleSaveTouchup} className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              Procedimento Realizado *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Toxina Botulínica"
                              value={newTouchupProcedure}
                              onChange={e => setNewTouchupProcedure(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#E0A98B]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              Data da Aplicação *
                            </label>
                            <input
                              type="date"
                              required
                              value={newTouchupPerformedDate}
                              onChange={e => {
                                setNewTouchupPerformedDate(e.target.value);
                                const d = new Date(e.target.value);
                                d.setDate(d.getDate() + newTouchupInterval);
                                setNewTouchupDueDate(d.toISOString().split('T')[0]);
                              }}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#E0A98B]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              Data Prevista do Retorno *
                            </label>
                            <input
                              type="date"
                              required
                              value={newTouchupDueDate}
                              onChange={e => setNewTouchupDueDate(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-[#E0A98B]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                            Observações / Orientações do Retorno
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Avaliar assimetria na sobrancelha direita e retoque de 2 unidades"
                            value={newTouchupNotes}
                            onChange={e => setNewTouchupNotes(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#E0A98B]"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsTouchupFormOpen(false)}
                            className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingTouchup}
                            className="px-5 py-2 bg-[#E0A98B] text-black rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {savingTouchup ? 'Salvando...' : 'Salvar Alerta de Retorno'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Lista de Retornos Agendados */}
                  <div className="space-y-3">
                    {touchups.length === 0 ? (
                      <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl bg-white/50 dark:bg-zinc-900/50">
                        <RotateCcw className="w-12 h-12 text-[#E0A98B] mx-auto mb-3 opacity-40" />
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                          Nenhum ciclo de retorno cadastrado
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                          Cadastre os procedimentos realizados para ser notificada e chamar a cliente no WhatsApp quando o retorno estiver próximo.
                        </p>
                      </div>
                    ) : (
                      touchups.map(t => {
                        const today = new Date().toISOString().split('T')[0];
                        const dueDate = new Date(t.return_due_date);
                        const isOverdue = t.return_due_date < today && t.status !== 'completed';
                        const isDueSoon = t.return_due_date === today;

                        const rawPhone = (clientPhone || '').replace(/\D/g, '');
                        const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                        const message = `Olá ${clientName}! Tudo bem? Passando para lembrar que está na data do seu retorno de ${t.procedure_name} agendado para ${new Date(t.return_due_date).toLocaleDateString('pt-BR')}. Vamos marcar o seu melhor horário?`;
                        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

                        return (
                          <div 
                            key={t.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                              t.status === 'completed'
                                ? 'bg-gray-50 dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800 opacity-60'
                                : isOverdue
                                ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
                                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-sm'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                  {t.procedure_name}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  t.status === 'completed'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                                    : t.status === 'contacted'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                                    : isOverdue
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                                }`}>
                                  {t.status === 'completed' 
                                    ? 'Retorno Concluído' 
                                    : t.status === 'contacted'
                                    ? 'Cliente Notificada' 
                                    : isOverdue 
                                    ? 'Retorno Atrasado' 
                                    : 'Aguardando Retorno'}
                                </span>
                              </div>

                              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
                                <span>Aplicação: {new Date(t.performed_date).toLocaleDateString('pt-BR')}</span>
                                <span>•</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                  Data do Retorno: {new Date(t.return_due_date).toLocaleDateString('pt-BR')}
                                </span>
                              </div>

                              {t.notes && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                  "{t.notes}"
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => {
                                  if (t.status === 'pending') {
                                    handleUpdateTouchupStatus(t.id, 'contacted');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#20bd5a] transition-all shadow-sm active:scale-95"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Chamar no WhatsApp
                              </a>

                              {t.status !== 'completed' ? (
                                <button
                                  onClick={() => handleUpdateTouchupStatus(t.id, 'completed')}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100"
                                >
                                  Concluir
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateTouchupStatus(t.id, 'pending')}
                                  className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Reabrir
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteTouchup(t.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB GERAL / EVOLUÇÃO (PSICOLOGIA OU ESTÉTICA) */}
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          placeholder="Buscar anotações..." 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#E0A98B]"
                        />
                      </div>
                    </div>

                    {!isNoteFormOpen && (
                      <button
                        onClick={() => {
                          setEditingNoteId(null);
                          setNoteForm({
                            title: '',
                            content: '',
                            session_date: new Date().toISOString().split('T')[0],
                            session_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                            patient_mood: 'Estável / Calmo',
                            therapeutic_goals: '',
                            techniques_used: '',
                            is_private: true
                          });
                          setIsNoteFormOpen(true);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                          isAesthetics 
                            ? 'bg-[#E0A98B] text-black hover:opacity-90' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        {isAesthetics ? 'Nova Evolução do Procedimento' : 'Nova Anotação de Sessão'}
                      </button>
                    )}
                  </div>

                  {isNoteFormOpen && (
                    <div className="bg-white dark:bg-zinc-900 border-2 border-[#E0A98B]/30 rounded-2xl p-6 shadow-xl space-y-4 animate-in slide-in-from-top-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-zinc-800">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-serif">
                          {editingNoteId ? 'Editar Evolução' : 'Registrar Evolução do Atendimento'}
                        </h3>
                        <button onClick={() => setIsNoteFormOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">
                          Cancelar
                        </button>
                      </div>

                      <form onSubmit={handleSaveNote} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Data</label>
                            <input 
                              type="date" 
                              required
                              value={noteForm.session_date}
                              onChange={e => setNoteForm({ ...noteForm, session_date: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Horário</label>
                            <input 
                              type="time" 
                              value={noteForm.session_time}
                              onChange={e => setNoteForm({ ...noteForm, session_time: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              {isAesthetics ? 'Reação da Pele / Condição' : 'Humor Observado'}
                            </label>
                            <select
                              value={noteForm.patient_mood}
                              onChange={e => setNoteForm({ ...noteForm, patient_mood: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                            >
                              {isAesthetics ? (
                                <>
                                  <option value="Normal / Íntegra">Normal / Íntegra</option>
                                  <option value="Levemente Eritematosa (Vermelhidão)">Levemente Eritematosa (Vermelhidão)</option>
                                  <option value="Sensível / Reativa">Sensível / Reativa</option>
                                  <option value="Com Edema Localizado">Com Edema Localizado</option>
                                  <option value="Excelente Cicatrização">Excelente Cicatrização</option>
                                </>
                              ) : (
                                PSYCHOLOGY_MOOD_OPTIONS.map(m => (
                                  <option key={m.label} value={m.label}>{m.label}</option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                            {isAesthetics ? 'Procedimento / Técnica *' : 'Tema da Sessão *'}
                          </label>
                          <input 
                            type="text" 
                            required
                            placeholder={isAesthetics ? "Ex: Limpeza de pele profunda com extração + Alta frequência" : "Ex: Trabalho com regulação emocional"}
                            value={noteForm.title}
                            onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                            {isAesthetics ? 'Descrição dos Procedimentos & Reações da Pele *' : 'Evolução Clínica *'}
                          </label>
                          <textarea 
                            required
                            rows={4}
                            placeholder={isAesthetics ? "Descreva os ativos utilizados, parâmetros dos aparelhos, resposta da pele da cliente..." : "Descreva o desenvolvimento terapêutico..."}
                            value={noteForm.content}
                            onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3.5 text-xs leading-relaxed outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              {isAesthetics ? 'Produtos / Ativos Utilizados' : 'Técnicas Aplicadas'}
                            </label>
                            <input 
                              type="text" 
                              placeholder={isAesthetics ? "Ex: Ácido glicólico 10%, Sérum Hialurônico, Máscara Calmante" : "Ex: TCC"}
                              value={noteForm.techniques_used}
                              onChange={e => setNoteForm({ ...noteForm, techniques_used: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                              {isAesthetics ? 'Orientações para Casa (Pós-Procedimento)' : 'Metas Próxima Sessão'}
                            </label>
                            <input 
                              type="text" 
                              placeholder={isAesthetics ? "Ex: Protetor solar a cada 2h, não se expor ao sol por 48h" : "Ex: Registro de pensamentos"}
                              value={noteForm.therapeutic_goals}
                              onChange={e => setNoteForm({ ...noteForm, therapeutic_goals: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsNoteFormOpen(false)}
                            className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingNote}
                            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                              isAesthetics 
                                ? 'bg-[#E0A98B] text-black hover:opacity-90' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            {savingNote ? 'Salvando...' : 'Salvar Evolução'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Feed de Anotações */}
                  <div className="space-y-4">
                    {filteredNotes.length === 0 ? (
                      <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl bg-white/50 dark:bg-zinc-900/50">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-40" />
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                          Nenhuma anotação registrada ainda
                        </h4>
                      </div>
                    ) : (
                      filteredNotes.map(note => (
                        <div 
                          key={note.id}
                          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3"
                        >
                          <div className="flex justify-between items-start sm:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[#E0A98B]" />
                                {new Date(note.session_date).toLocaleDateString('pt-BR')}
                                {note.session_time && ` • ${note.session_time}`}
                              </span>
                              {note.patient_mood && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300">
                                  {note.patient_mood}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 font-serif">
                              {note.title}
                            </h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1.5 leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>

                          {(note.techniques_used || note.therapeutic_goals) && (
                            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              {note.techniques_used && (
                                <div className="bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-xl">
                                  <span className="font-bold text-[10px] text-gray-400 uppercase block">Ativos / Técnicas</span>
                                  <span className="text-gray-800 dark:text-gray-200">{note.techniques_used}</span>
                                </div>
                              )}
                              {note.therapeutic_goals && (
                                <div className="bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-xl">
                                  <span className="font-bold text-[10px] text-gray-400 uppercase block">Orientações / Metas</span>
                                  <span className="text-gray-800 dark:text-gray-200">{note.therapeutic_goals}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB AGENDA */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800 text-xs font-bold text-gray-600 dark:text-gray-300 flex justify-between items-center">
                      <span>Histórico de Atendimentos na Agenda ({appointments.length})</span>
                      <span className="text-[11px] text-gray-400">Vinculado à Agenda Geral</span>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {appointments.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400">
                          Nenhum agendamento encontrado para esta cliente.
                        </div>
                      ) : (
                        appointments.map(appt => (
                          <div key={appt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-zinc-800/40">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                                  {appt.serviceName}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  appt.status === 'completed'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                    : appt.status === 'cancelled'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                                }`}>
                                  {appt.status === 'completed' ? 'Realizada' : appt.status === 'cancelled' ? 'Cancelada' : 'Agendada'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                                <span>📅 {new Date(appt.date).toLocaleDateString('pt-BR')} às {appt.start_time}</span>
                                <span>👤 {appt.barberName}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setActiveTab('notes');
                                setIsNoteFormOpen(true);
                                setEditingNoteId(null);
                                setNoteForm({
                                  title: `Procedimento: ${appt.serviceName}`,
                                  content: '',
                                  session_date: appt.date,
                                  session_time: appt.start_time || '',
                                  patient_mood: isAesthetics ? 'Normal / Íntegra' : 'Estável / Calmo',
                                  therapeutic_goals: '',
                                  techniques_used: '',
                                  is_private: true
                                });
                              }}
                              className="self-start sm:self-auto px-3 py-1.5 bg-[#E0A98B]/20 text-gray-900 dark:text-white rounded-xl text-xs font-bold hover:bg-[#E0A98B]/30 transition-colors flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#C47C62]" />
                              Registrar Evolução Desta Sessão
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70 flex justify-between items-center text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Ficha confidencial salva com criptografia local e em nuvem.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
