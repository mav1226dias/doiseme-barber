import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Printer, Copy, Check, ExternalLink, Sparkles, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeCardProps {
  bookingUrl: string;
  shopName?: string;
  primaryColor?: string;
  businessTerm?: string;
  className?: string;
}

export default function QRCodeCard({
  bookingUrl,
  shopName = 'Agendamento Online',
  primaryColor = '#D4AF37',
  businessTerm = 'Estabelecimento',
  className = ''
}: QRCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bookingUrl) return;
    QRCode.toDataURL(bookingUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Erro ao gerar QR Code:', err));
  }, [bookingUrl]);

  const copyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success('Link do site copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Download complete branded plaque/card with QR Code and URL
  const downloadCardWithSite = async () => {
    if (!bookingUrl || !qrDataUrl) {
      toast.error('Aguarde o carregamento do QR Code...');
      return;
    }

    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Falha ao inicializar renderizador gráfico');

      const width = 1000;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;

      // 1. White Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // 2. Top Aesthetic Banner / Header Band
      const headerColor = primaryColor || '#D4AF37';
      ctx.fillStyle = headerColor;
      ctx.fillRect(0, 0, width, 24);

      // Inner Border
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 4;
      ctx.strokeRect(36, 48, width - 72, height - 84);

      // 3. Category / Tag Badge
      ctx.fillStyle = '#F4F4F5';
      const badgeText = 'AGENDAMENTO ONLINE';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      const textMetrics = ctx.measureText(badgeText);
      const badgeWidth = textMetrics.width + 48;
      const badgeHeight = 44;
      const badgeX = (width - badgeWidth) / 2;
      const badgeY = 90;

      // Rounded rect for badge
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 12);
      ctx.fill();

      ctx.fillStyle = '#18181B';
      ctx.fillText(badgeText, width / 2, badgeY + 29);

      // 4. Business Name
      ctx.fillStyle = '#09090B';
      ctx.font = 'bold 46px serif, Georgia, sans-serif';
      ctx.textAlign = 'center';
      
      // Truncate long business name if needed
      const maxNameWidth = width - 140;
      let displayName = shopName;
      if (ctx.measureText(displayName).width > maxNameWidth) {
        while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 5) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '...';
      }
      ctx.fillText(displayName, width / 2, 195);

      // Subtitle
      ctx.fillStyle = '#71717A';
      ctx.font = '500 24px sans-serif';
      ctx.fillText('Aponte a câmera do celular para agendar seu horário', width / 2, 245);

      // 5. Draw QR Code in Center
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });

      const qrSize = 520;
      const qrX = (width - qrSize) / 2;
      const qrY = 295;

      // Card frame behind QR code
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      ctx.beginPath();
      ctx.roundRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 28);
      ctx.fill();

      // Reset shadows
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // QR Border
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw QR image
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 6. Highlighted Website URL Box
      const urlBoxWidth = width - 160;
      const urlBoxHeight = 160;
      const urlBoxX = (width - urlBoxWidth) / 2;
      const urlBoxY = 880;

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(urlBoxX, urlBoxY, urlBoxWidth, urlBoxHeight, 20);
      ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.stroke();

      // "OU ACESSE DIRETAMENTE PELO SITE"
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('OU ACESSE DIRETAMENTE PELO LINK:', width / 2, urlBoxY + 45);

      // Complete URL in bold
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 30px monospace, sans-serif';
      
      let displayUrl = bookingUrl;
      if (ctx.measureText(displayUrl).width > urlBoxWidth - 40) {
        ctx.font = 'bold 24px monospace, sans-serif';
      }
      ctx.fillText(displayUrl, width / 2, urlBoxY + 95);

      // Short hint
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 16px sans-serif';
      ctx.fillText('Disponível 24h por dia para agendamentos rápidos', width / 2, urlBoxY + 132);

      // 7. Footer Notice
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '500 20px sans-serif';
      ctx.fillText('Praticidade, rapidez e sem necessidade de baixar aplicativos.', width / 2, 1100);

      // Bottom bar
      ctx.fillStyle = headerColor;
      ctx.fillRect(urlBoxX, 1160, urlBoxWidth, 6);

      // Trigger download
      const safeSlug = shopName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const fileName = `qrcode-${safeSlug}-com-site.png`;

      const dataUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success('Plaquinha com o QR Code e o Link do site salva com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar imagem com o site');
    } finally {
      setGenerating(false);
    }
  };

  // Download isolated QR Code PNG (e.g. for graphic designers)
  const downloadJustQrCode = () => {
    if (!qrDataUrl) return;
    const safeSlug = shopName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const downloadLink = document.createElement('a');
    downloadLink.href = qrDataUrl;
    downloadLink.download = `qrcode-${safeSlug}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success('QR Code baixado com sucesso!');
  };

  const handlePrintPlaque = () => {
    setIsPrintModalOpen(true);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <div className={`bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm text-center ${className}`}>
      {/* Icon & Title */}
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: primaryColor || '#D4AF37' }}
      >
        <QrCode className="w-6 h-6 text-black" />
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        QR Code & Placa de Balcão
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        Posicione na recepção, bancada ou poste nas redes para seus clientes agendarem escaneando ou acessando o link.
      </p>

      {/* QR Code Container with Website Preview */}
      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-zinc-950 dark:to-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 mb-6 shadow-inner text-center">
        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400 block mb-3">
          {shopName}
        </span>

        {qrDataUrl ? (
          <div className="bg-white p-4 rounded-2xl inline-block border-2 border-gray-100 dark:border-zinc-700 shadow-md">
            <img 
              src={qrDataUrl} 
              alt="QR Code de Agendamento" 
              className="w-48 h-48 sm:w-52 sm:h-52 mx-auto block"
            />
          </div>
        ) : (
          <div className="w-48 h-48 sm:w-52 sm:h-52 mx-auto flex items-center justify-center bg-gray-100 dark:bg-zinc-800 rounded-2xl animate-pulse">
            <span className="text-xs text-gray-400">Gerando QR Code...</span>
          </div>
        )}

        {/* The Website Link prominently displayed */}
        <div className="mt-4 p-3 bg-white dark:bg-zinc-800/80 rounded-xl border border-gray-200 dark:border-zinc-700 flex items-center justify-between gap-2 max-w-md mx-auto text-left shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-mono text-xs text-gray-700 dark:text-gray-200 truncate select-all">
              {bookingUrl}
            </span>
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors shrink-0"
            title="Copiar Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Main Button: Save Image with Site */}
        <button 
          type="button"
          onClick={downloadCardWithSite}
          disabled={generating || !qrDataUrl}
          className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm text-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: primaryColor || '#D4AF37' }}
        >
          <Download className="w-4 h-4" />
          <span>{generating ? 'Gerando Imagem...' : 'Salvar QR Code com o Site (PNG)'}</span>
        </button>

        {/* Secondary Options Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={handlePrintPlaque}
            className="py-2.5 px-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl text-gray-800 dark:text-gray-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-gray-500" />
            <span>Imprimir Plaquinha</span>
          </button>

          <button 
            type="button"
            onClick={downloadJustQrCode}
            className="py-2.5 px-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl text-gray-800 dark:text-gray-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Apenas QR (PNG)</span>
          </button>
        </div>
      </div>

      {/* Hidden Print Styling to ensure only the clean plaque is printed */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-qr-plaque, #printable-qr-plaque * {
            visibility: visible;
          }
          #printable-qr-plaque {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white !important;
            padding: 40px;
            z-index: 999999;
          }
        }
      `}</style>

      {/* Printable Plaque Container (rendered offscreen or on print) */}
      <div id="printable-qr-plaque" className="hidden print:flex">
        <div className="w-full max-w-lg border-4 border-gray-900 p-10 rounded-3xl text-center bg-white text-black space-y-6 shadow-none">
          <div className="text-xs font-bold tracking-widest uppercase border-b-2 border-black pb-2">
            AGENDAMENTO ONLINE
          </div>

          <h1 className="text-3xl font-bold font-serif text-black">
            {shopName}
          </h1>

          <p className="text-sm text-gray-600">
            Aponte a câmera do seu celular para agendar seu horário em segundos:
          </p>

          {qrDataUrl && (
            <div className="p-4 border-2 border-gray-300 rounded-2xl inline-block bg-white mx-auto">
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
            </div>
          )}

          <div className="p-4 bg-gray-100 rounded-xl border border-gray-300">
            <span className="text-xs font-bold text-gray-500 block mb-1">
              OU ACESSE PELO SITE:
            </span>
            <span className="font-mono text-base font-bold text-black break-all">
              {bookingUrl}
            </span>
          </div>

          <p className="text-xs text-gray-500 pt-2">
            Disponível 24 horas por dia • Sem necessidade de instalar aplicativos
          </p>
        </div>
      </div>
    </div>
  );
}
