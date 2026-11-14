import React, { useState, useEffect, useRef } from 'react';
import { Search, Upload, Users, UserPlus, Trash2, Brain, Sparkles, AlertTriangle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { getSegment } from '../../lib/segments';
import PatientRecordModal from '../../components/PatientRecordModal';

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [segment, setSegment] = useState('barbershop');
  const [selectedClientForRecord, setSelectedClientForRecord] = useState<any | null>(null);
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);
  const [pendingImportClients, setPendingImportClients] = useState<{ name: string; phone: string }[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userRole] = useState<string>(() => {
    const token = localStorage.getItem('token');
    if (!token) return 'admin';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'admin';
    } catch {
      return 'admin';
    }
  });
  const isBarber = userRole === 'barber';

  // New Client Form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const fetchClients = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/admin/clients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (res.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
          return [];
        }
        if (!res.ok) return [];
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => setClients(data || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchClients();
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

  useEffect(() => {
    setSelectedIds([]);
  }, [searchTerm]);

  const handleDelete = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setDeleteConfirmIds(ids);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmIds || deleteConfirmIds.length === 0) return;
    const idsToDelete = [...deleteConfirmIds];
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const isSingle = idsToDelete.length === 1;
      const res = await fetch(
        isSingle ? `/api/admin/clients/${encodeURIComponent(idsToDelete[0])}` : '/api/admin/clients/delete',
        {
          method: isSingle ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: isSingle ? undefined : JSON.stringify({ ids: idsToDelete })
        }
      );

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (res.ok) {
        setClients((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
        setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
        setDeleteConfirmIds(null);
        toast.success(
          idsToDelete.length === 1
            ? 'Cliente excluído com sucesso!'
            : `${idsToDelete.length} clientes excluídos com sucesso!`
        );
        fetchClients();
      } else {
        toast.error(data?.error || 'Erro ao excluir clientes.');
      }
    } catch {
      toast.error('Erro de rede ao excluir clientes.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName, phone: newPhone.replace(/\D/g, '') })
      });
      if (res.ok) {
        toast.success('Cliente adicionado com sucesso!');
        setIsModalOpen(false);
        setNewName('');
        setNewPhone('');
        fetchClients();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao adicionar cliente');
      }
    } catch {
      toast.error('Erro ao adicionar cliente');
    }
    setLoading(false);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportClients || pendingImportClients.length === 0) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/clients/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clients: pendingImportClients })
      });
      if (!res.ok) {
        let msg = `Erro do servidor (Status ${res.status})`;
        try {
          const errData = await res.json();
          msg = errData.error || msg;
        } catch {
          // keep default message
        }
        throw new Error(msg);
      }
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.count} cliente(s) importado(s) com sucesso!`);
        setPendingImportClients(null);
        fetchClients();
      } else {
        toast.error('Erro na importação.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Falha na importação: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    const processData = (parsedClients: {name: string, phone: string}[]) => {
      const validClients = parsedClients.filter(c => c.phone && c.phone.length > 5);
      if (validClients.length === 0) {
        toast.error('Nenhum cliente válido encontrado. Verifique se o arquivo contém nome e telefone.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setPendingImportClients(validClients);
    };

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, {type:'binary'});
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Try to guess columns.
        const result = [];
        for (let i=0; i<data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          let name = '';
          let phone = '';
          
          row.forEach(cell => {
            const strCell = String(cell);
            // very basic phone check (at least 8 digits)
            const digits = strCell.replace(/\D/g, '');
            if (digits.length >= 8 && digits.length <= 15) {
              phone = digits;
            } else if (strCell.length > 2 && isNaN(Number(strCell))) {
              name = strCell;
            }
          });
          
          if (phone) result.push({ name, phone });
        }
        processData(result);
      };
      reader.readAsBinaryString(file);
    } else if (ext === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          const result = [];
          for (let row of results.data as string[][]) {
            let name = '';
            let phone = '';
            (row || []).forEach(cell => {
              const strCell = String(cell);
              const digits = strCell.replace(/\D/g, '');
              if (digits.length >= 8 && digits.length <= 15) {
                phone = digits;
              } else if (strCell.length > 2 && isNaN(Number(strCell))) {
                name = strCell;
              }
            });
            if (phone) result.push({ name, phone });
          }
          processData(result);
        }
      });
    } else if (ext === 'vcf') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const lines = text.split('\n');
        const result = [];
        let curName = '';
        let curPhone = '';
        
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('BEGIN:VCARD')) {
            curName = '';
            curPhone = '';
          } else if (line.startsWith('FN:')) {
            curName = line.substring(3).trim();
          } else if (line.startsWith('TEL') || line.includes(':TEL')) {
            const phoneStr = line.split(':')[1];
            if (phoneStr) {
               curPhone = phoneStr.replace(/\D/g, '');
            }
          } else if (line.startsWith('END:VCARD')) {
            if (curPhone) result.push({ name: curName, phone: curPhone });
          }
        }
        processData(result);
      };
      reader.readAsText(file);
    } else {
      toast.error('Formato não suportado. Use .xlsx, .csv ou .vcf.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  const allSelected = filteredClients.length > 0 && selectedIds.length === filteredClients.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredClients.map(c => c.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const currentPreset = getSegment(segment);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            {isBarber ? `Meus ${currentPreset.terms.clientPlural}` : currentPreset.terms.clientPlural}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isBarber
              ? `Seus ${currentPreset.terms.clientPlural.toLowerCase()} agendados ou atendidos por você (acesso restrito aos seus prontuários).`
              : `Gerencie a base de ${currentPreset.terms.clientPlural.toLowerCase()} da sua ${currentPreset.terms.business.toLowerCase()}`}
          </p>
        </div>
        
        {!isBarber && (
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black dark:bg-zinc-100 text-white dark:text-black px-4 py-2 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-white transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Novo {currentPreset.terms.client}
            </button>
            
            <div>
              <input 
                type="file" 
                accept=".vcf,.csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-[#D4AF37] text-white px-4 py-2 rounded-xl font-medium hover:bg-[#b0912e] transition-colors"
              >
                <Upload className="w-4 h-4" /> Importar Lista
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou número..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl pl-10 pr-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>
        </div>

        {filteredClients.length > 0 ? (
          <div className="flex flex-col">
            {!isBarber && selectedIds.length > 0 && (
              <div className="bg-[#D4AF37]/10 dark:bg-[#D4AF37]/5 border-b border-[#D4AF37]/20 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#D4AF37]">
                  {selectedIds.length} cliente(s) selecionado(s)
                </span>
                <button 
                  disabled={loading}
                  onClick={() => handleDelete(selectedIds)}
                  className="flex items-center gap-2 text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Excluir Selecionados
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-800 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {!isBarber && (
                      <th className="p-4 w-12 text-center">
                        <input 
                          type="checkbox" 
                          checked={allSelected}
                          onChange={handleSelectAll}
                          className="rounded w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="p-4">Nome</th>
                    <th className="p-4">Telefone</th>
                    <th className="p-4 text-center">
                      {segment === 'aesthetics' || segment === 'lash_design' || segment === 'beauty_salon'
                        ? 'Ficha Estética & Retoques' 
                        : segment === 'psychology' 
                        ? 'Prontuário & Evoluções' 
                        : 'Prontuário / Ficha'}
                    </th>
                    {!isBarber && <th className="p-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {filteredClients.map(c => {
                    const isAesthetics = segment === 'aesthetics' || segment === 'lash_design' || segment === 'beauty_salon';
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        {!isBarber && (
                          <td className="p-4 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(c.id)}
                              onChange={() => handleSelectOne(c.id)}
                              className="rounded w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="p-4 font-medium text-gray-900 dark:text-gray-100">
                          <button 
                            onClick={() => setSelectedClientForRecord(c)}
                            className="hover:text-[#C47C62] dark:hover:text-[#E0A98B] font-bold transition-colors text-left"
                            title="Abrir ficha do cliente"
                          >
                            {c.name || 'Sem nome'}
                          </button>
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{c.phone}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedClientForRecord(c)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                              isAesthetics
                                ? 'bg-[#E0A98B]/15 text-[#C47C62] dark:text-[#E0A98B] border border-[#E0A98B]/30 hover:bg-[#E0A98B]/25'
                                : segment === 'psychology'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {isAesthetics ? (
                              <Sparkles className="w-3.5 h-3.5 text-[#C47C62] dark:text-[#E0A98B]" />
                            ) : (
                              <Brain className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                            <span>
                              {isAesthetics 
                                ? 'Ficha Estética' 
                                : segment === 'psychology' 
                                ? 'Prontuário Clínico' 
                                : 'Ficha & Anotações'}
                            </span>
                          </button>
                        </td>
                        {!isBarber && (
                          <td className="p-4 text-right">
                            <button 
                              disabled={loading}
                              onClick={() => handleDelete([c.id])}
                              className="text-gray-400 hover:text-red-500 transition-colors p-2 disabled:opacity-50 shrink-0"
                              title="Excluir Cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-700 mb-4" />
            {clients.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado na busca.'}
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">
                Cadastrar {currentPreset.terms.client}
              </h2>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do(a) {currentPreset.terms.client}
                </label>
                <input 
                  type="text" 
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 outline-none focus:border-black dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone (WhatsApp)</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: 53981536614"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 outline-none focus:border-black dark:focus:border-white font-mono"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#D4AF37] text-white rounded-xl font-bold hover:bg-[#b0912e] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmIds && deleteConfirmIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-6 flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {deleteConfirmIds.length === 1
                    ? `Excluir ${currentPreset.terms.client.toLowerCase()}?`
                    : `Excluir ${deleteConfirmIds.length} ${currentPreset.terms.clientPlural.toLowerCase()}?`}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {deleteConfirmIds.length === 1
                    ? `Tem certeza que deseja excluir "${clients.find(c => c.id === deleteConfirmIds[0])?.name || 'este contato'}"? `
                    : `Tem certeza que deseja excluir os ${deleteConfirmIds.length} registros selecionados? `}
                  Esta ação apagará o contato, histórico de agendamentos e fichas vinculadas permanentemente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !loading && setDeleteConfirmIds(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteConfirmIds(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {loading ? 'Excluindo...' : 'Excluir Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {pendingImportClients && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Confirmar Importação
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                Foram encontrados <strong>{pendingImportClients.length}</strong> contato(s) válidos no arquivo. Deseja importar para a sua base?
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setPendingImportClients(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmImport}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-white hover:bg-[#b0912e] transition-colors disabled:opacity-50"
              >
                {loading ? 'Importando...' : 'Importar Agora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Clinical Record Modal */}
      {selectedClientForRecord && (
        <PatientRecordModal
          clientId={selectedClientForRecord.id}
          clientName={selectedClientForRecord.name || 'Paciente'}
          clientPhone={selectedClientForRecord.phone || ''}
          segment={segment}
          onClose={() => setSelectedClientForRecord(null)}
        />
      )}

    </div>
  );
}
