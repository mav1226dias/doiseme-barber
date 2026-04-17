import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Upload, Users, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Client Form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const fetchClients = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/admin/clients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setClients(data || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchClients();
  }, []);

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
        alert('Cliente adicionado com sucesso!');
        setIsModalOpen(false);
        setNewName('');
        setNewPhone('');
        fetchClients();
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao adicionar cliente');
      }
    } catch (err) {
      alert('Erro ao adicionar cliente');
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    const processData = (parsedClients: {name: string, phone: string}[]) => {
      const validClients = parsedClients.filter(c => c.phone && c.phone.length > 5);
      if (validClients.length === 0) {
        alert('Nenhum cliente válido encontrado. Verifique se o arquivo contém nome e telefone (ou apenas telefone).');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (window.confirm(`Foram encontrados ${validClients.length} contatos. Deseja importar?`)) {
        setLoading(true);
        const token = localStorage.getItem('token');
        fetch('/api/admin/clients/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ clients: validClients })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              alert(`${data.count} clientes importados com sucesso!`);
              fetchClients();
            } else {
              alert('Erro na importação.');
            }
          })
          .catch(err => {
            console.error(err);
            alert('Erro de rede na importação.');
          })
          .finally(() => {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          });
      } else {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
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
      alert('Formato não suportado. Use .xlsx, .csv ou .vcf.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie a sua base de contatos</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-black dark:bg-zinc-100 text-white dark:text-black px-4 py-2 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-white transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Cadastrar Novo
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-800 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <th className="p-4">Nome</th>
                  <th className="p-4">Telefone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{c.name || 'Sem nome'}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300 font-mono">{c.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">Cadastrar Cliente</h2>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Cliente</label>
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

    </div>
  );
}
