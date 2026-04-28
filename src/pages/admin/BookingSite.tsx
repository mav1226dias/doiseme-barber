import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Globe, Smartphone, QrCode, Share2 } from 'lucide-react';
import { slugify } from '../../lib/slugify';

export default function BookingSite() {
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/shop-info', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setShop(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const bookingUrl = shop?.slug 
    ? `${window.location.origin}/b/${shop.slug}`
    : `${window.location.origin}/b/${shop?.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4AF37]"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Seu Site de Agendamento</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Este é o link que você deve enviar para seus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* URL Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Globe className="w-32 h-32" />
             </div>
             
             <div className="relative z-10">
                <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-widest mb-4">Link Público</h2>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center bg-gray-50 dark:bg-zinc-950 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                   <div className="flex-1 font-mono text-sm break-all text-gray-600 dark:text-gray-300">
                      {bookingUrl}
                   </div>
                   <div className="flex gap-2">
                      <button 
                        onClick={copyToClipboard}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-[#D4AF37] text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-95"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </button>
                      <a 
                        href={bookingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl text-sm font-bold hover:bg-gray-300 dark:hover:bg-zinc-700 transition-all active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir
                      </a>
                   </div>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="bg-gray-50 dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800">
                      <div className="w-10 h-10 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-4 text-[#D4AF37]">
                         <Smartphone className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Otimizado para Mobile</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Seus clientes podem agendar de qualquer lugar, direto do celular, sem precisar baixar nada.</p>
                   </div>
                   <div className="bg-gray-50 dark:bg-zinc-950 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800">
                      <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mb-4 text-green-500">
                         <Share2 className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Fácil de Compartilhar</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Coloque este link na sua bio do Instagram, status do WhatsApp ou envie por mensagem.</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
             <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-[#D4AF37]" /> Visualização em Tempo Real
             </h2>
             <div className="aspect-[9/16] max-w-sm mx-auto border-[8px] border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl bg-zinc-950">
                <iframe 
                  src={bookingUrl} 
                  title="Booking Preview"
                  className="w-full h-full border-0"
                />
             </div>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm text-center">
              <div className="w-12 h-12 bg-black dark:bg-[#D4AF37] rounded-2xl flex items-center justify-center mx-auto mb-6 text-white dark:text-black shadow-lg">
                 <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">QR Code da Loja</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Imprima e coloque em sua bancada ou na vitrine da barbearia.</p>
              
              <div className="bg-white p-4 rounded-2xl inline-block border-4 border-gray-50 mb-8 shadow-inner">
                 <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(bookingUrl)}`} 
                    alt="QR Code"
                    className="w-48 h-48"
                 />
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full py-4 bg-gray-100 dark:bg-zinc-800 rounded-2xl text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
              >
                 Salvar para Imprimir
              </button>
           </div>

           <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30">
              <h4 className="font-bold text-blue-900 dark:text-blue-400 mb-2 flex items-center gap-2">
                 Dica de Marketing
              </h4>
              <p className="text-xs text-blue-800/70 dark:text-blue-500/70 leading-relaxed">
                 Barbeiros que oferecem agendamento online aumentam sua produtividade em até 40% pois não perdem tempo atendendo telefone durante o serviço.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
