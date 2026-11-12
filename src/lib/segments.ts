export interface SegmentPreset {
  id: string;
  name: string;
  category: 'beauty' | 'health' | 'creative' | 'technical';
  icon: string;
  terms: {
    business: string;        // ex: 'Barbearia', 'Clínica', 'Studio'
    businessPlural: string;
    professional: string;    // ex: 'Barbeiro', 'Esteticista', 'Fotógrafo'
    professionalPlural: string;
    client: string;          // ex: 'Cliente', 'Paciente', 'Aluno'
    clientPlural: string;
    service: string;         // ex: 'Serviço', 'Procedimento', 'Consulta', 'Sessão'
    servicePlural: string;
  };
  defaultColors: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  layoutTheme: {
    badge: string;              // Badge label, e.g. 'Barbearia Premium', 'Clínica Especializada'
    tagline: string;            // Subtitle, e.g. 'Cuidado de alta precisão e estética avançada'
    containerClass: string;     // Tailwind classes for card style, borders, glow
    fontFamily: string;         // 'font-serif', 'font-sans', or 'font-mono'
    accentBg: string;           // Background tint
    backgroundAtmosphere: string; // Ambient background gradient
    glowColor: string;          // Ambient backdrop glow
    palettePresets: Array<{ name: string; hex: string }>; // Curated color palettes for this niche
  };
  suggestedServices: Array<{
    name: string;
    durationMinutes: number;
    price: number;
  }>;
}

export const SEGMENTS: Record<string, SegmentPreset> = {
  // 1. Barbearia Conceito
  barbershop: {
    id: 'barbershop',
    name: 'Barbearia Conceito',
    category: 'beauty',
    icon: 'Scissors',
    terms: {
      business: 'Barbearia',
      businessPlural: 'Barbearias',
      professional: 'Barbeiro',
      professionalPlural: 'Profissionais',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Serviço',
      servicePlural: 'Serviços',
    },
    defaultColors: {
      primary: '#D4AF37', // Ouro Imperial
      secondary: '#0F0E0B',
      accent: '#F3E5AB',
    },
    layoutTheme: {
      badge: 'Barbearia Premium',
      tagline: 'Cortes clássicos, barboterapia e cuidados masculinos de alto padrão',
      containerClass: 'border-[#D4AF37]/35 bg-zinc-950/85 shadow-[0_0_50px_-12px_rgba(212,175,55,0.22)] rounded-2xl',
      fontFamily: 'font-serif',
      accentBg: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/25',
      backgroundAtmosphere: 'from-[#1a1406] via-[#0b0a07] to-[#070605]',
      glowColor: 'rgba(212, 175, 55, 0.25)',
      palettePresets: [
        { name: 'Ouro Imperial', hex: '#D4AF37' },
        { name: 'Cobre Envelhecido', hex: '#C87D55' },
        { name: 'Prata Platina', hex: '#E5E7EB' },
      ],
    },
    suggestedServices: [
      { name: 'Corte de Cabelo Masculino', durationMinutes: 30, price: 50 },
      { name: 'Design de Barba com Navalha', durationMinutes: 30, price: 40 },
      { name: 'Barboterapia com Toalha Quente', durationMinutes: 45, price: 60 },
      { name: 'Terapia Capilar & Pigmentação', durationMinutes: 60, price: 90 },
    ],
  },

  // 2. Clínica de Estética Avançada
  aesthetics: {
    id: 'aesthetics',
    name: 'Clínica de Estética Avançada',
    category: 'beauty',
    icon: 'Sparkles',
    terms: {
      business: 'Clínica de Estética',
      businessPlural: 'Clínicas',
      professional: 'Esteticista',
      professionalPlural: 'Especialistas',
      client: 'Paciente',
      clientPlural: 'Pacientes',
      service: 'Procedimento',
      servicePlural: 'Procedimentos',
    },
    defaultColors: {
      primary: '#E0A98B', // Champagne Rosé / Bronze Nude
      secondary: '#181210',
      accent: '#F7D6C4',
    },
    layoutTheme: {
      badge: 'Estética Médica & Harmonização',
      tagline: 'Procedimentos faciais e corporais de alta tecnologia e precisão',
      containerClass: 'border-[#E0A98B]/35 bg-[#140e0c]/90 backdrop-blur-xl shadow-[0_0_50px_-10px_rgba(224,169,139,0.25)] rounded-[2.5rem]',
      fontFamily: 'font-sans',
      accentBg: 'bg-[#E0A98B]/15 text-[#F7D6C4] border-[#E0A98B]/30',
      backgroundAtmosphere: 'from-[#241713] via-[#100b09] to-[#090605]',
      glowColor: 'rgba(224, 169, 139, 0.28)',
      palettePresets: [
        { name: 'Champagne Rosé', hex: '#E0A98B' },
        { name: 'Terracota Suave', hex: '#C47C62' },
        { name: 'Nude Pérola', hex: '#E8D5C4' },
      ],
    },
    suggestedServices: [
      { name: 'Aplicação de Toxina Botulínica (Botox)', durationMinutes: 45, price: 850 },
      { name: 'Preenchimento Labial com Ácido Hialurônico', durationMinutes: 60, price: 1200 },
      { name: 'Harmonização Facial Full Face', durationMinutes: 90, price: 2500 },
      { name: 'Peeling Químico Renovador', durationMinutes: 45, price: 280 },
      { name: 'Drenagem Linfática Facial e Corporal', durationMinutes: 60, price: 180 },
    ],
  },

  // 3. Studio de Lash Design & Sobrancelhas
  lash_design: {
    id: 'lash_design',
    name: 'Studio de Lash Design & Sobrancelhas',
    category: 'beauty',
    icon: 'Eye',
    terms: {
      business: 'Studio',
      businessPlural: 'Studios',
      professional: 'Lash Designer',
      professionalPlural: 'Designers',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Procedimento',
      servicePlural: 'Procedimentos',
    },
    defaultColors: {
      primary: '#F472B6', // Rosa Nude Chic
      secondary: '#1A0D16',
      accent: '#FBCFE8',
    },
    layoutTheme: {
      badge: 'Lash & Brow Boutique',
      tagline: 'Realce natural do seu olhar com técnicas exclusivas de extensão',
      containerClass: 'border-[#F472B6]/35 bg-[#150a12]/90 shadow-[0_0_45px_-10px_rgba(244,114,182,0.28)] rounded-[2.5rem]',
      fontFamily: 'font-sans',
      accentBg: 'bg-[#F472B6]/15 text-[#FBCFE8] border-[#F472B6]/30',
      backgroundAtmosphere: 'from-[#281020] via-[#12080f] to-[#0a0408]',
      glowColor: 'rgba(244, 114, 182, 0.28)',
      palettePresets: [
        { name: 'Rosé Chic', hex: '#F472B6' },
        { name: 'Magenta Glam', hex: '#E11D48' },
        { name: 'Lavanda Suave', hex: '#C084FC' },
      ],
    },
    suggestedServices: [
      { name: 'Extensão de Cílios Volume Russo', durationMinutes: 120, price: 190 },
      { name: 'Extensão Fio a Fio Clássica', durationMinutes: 90, price: 150 },
      { name: 'Lash Lifting & Nutrição', durationMinutes: 60, price: 120 },
      { name: 'Design de Sobrancelhas com Henna', durationMinutes: 40, price: 65 },
      { name: 'Brow Lamination Completa', durationMinutes: 60, price: 140 },
    ],
  },

  // 4. Salão de Beleza Premium
  beauty_salon: {
    id: 'beauty_salon',
    name: 'Salão de Beleza Premium',
    category: 'beauty',
    icon: 'Crown',
    terms: {
      business: 'Salão de Beleza',
      businessPlural: 'Salões',
      professional: 'Hair Stylist',
      professionalPlural: 'Profissionais',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Serviço',
      servicePlural: 'Serviços',
    },
    defaultColors: {
      primary: '#F59E0B', // Ouro Quente
      secondary: '#181208',
      accent: '#FDE68A',
    },
    layoutTheme: {
      badge: 'Haute Coiffure & Beauty',
      tagline: 'Transformação, mechas, estética capilar e beleza integral',
      containerClass: 'border-[#F59E0B]/35 bg-zinc-950/90 shadow-[0_0_50px_-10px_rgba(245,158,11,0.25)] rounded-3xl',
      fontFamily: 'font-serif',
      accentBg: 'bg-[#F59E0B]/15 text-[#FDE68A] border-[#F59E0B]/30',
      backgroundAtmosphere: 'from-[#261806] via-[#110b03] to-[#080501]',
      glowColor: 'rgba(245, 158, 11, 0.28)',
      palettePresets: [
        { name: 'Ouro Quente', hex: '#F59E0B' },
        { name: 'Caramelo Nobre', hex: '#D97706' },
        { name: 'Platina Cristal', hex: '#F3F4F6' },
      ],
    },
    suggestedServices: [
      { name: 'Corte & Escova Modelada', durationMinutes: 60, price: 140 },
      { name: 'Coloração & Tratamento Profundo', durationMinutes: 90, price: 220 },
      { name: 'Mechas Criativas / Balayage', durationMinutes: 180, price: 480 },
      { name: 'Progressiva Orgânica sem Formol', durationMinutes: 150, price: 320 },
      { name: 'Spa de Pés e Mãos Completo', durationMinutes: 60, price: 95 },
    ],
  },

  // 5. Studio de Tatuagem & Piercing
  tattoo: {
    id: 'tattoo',
    name: 'Studio de Tatuagem & Piercing',
    category: 'creative',
    icon: 'PenTool',
    terms: {
      business: 'Studio de Tattoo',
      businessPlural: 'Studios',
      professional: 'Tatuador',
      professionalPlural: 'Tatuadores',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Sessão / Arte',
      servicePlural: 'Sessões',
    },
    defaultColors: {
      primary: '#EF4444', // Rubro Carmim / Dark Ink
      secondary: '#101012',
      accent: '#FCA5A5',
    },
    layoutTheme: {
      badge: 'Ateliê Autoral de Tatuagem',
      tagline: 'Arte autoral na pele, biossegurança rigorosa e projetos exclusivos',
      containerClass: 'border-red-600/35 bg-[#0d0909]/95 shadow-[0_0_50px_-10px_rgba(239,68,68,0.28)] rounded-2xl',
      fontFamily: 'font-mono',
      accentBg: 'bg-red-500/15 text-red-400 border-red-500/30',
      backgroundAtmosphere: 'from-[#290a0a] via-[#100606] to-[#080303]',
      glowColor: 'rgba(239, 68, 68, 0.32)',
      palettePresets: [
        { name: 'Rubro Carmim', hex: '#EF4444' },
        { name: 'Laranja Chumbo', hex: '#F97316' },
        { name: 'Branco Gótico', hex: '#F8FAFC' },
      ],
    },
    suggestedServices: [
      { name: 'Tatuagem Autoral (Sessão Rápida)', durationMinutes: 90, price: 350 },
      { name: 'Tatuagem Autoral (Meio Período)', durationMinutes: 180, price: 700 },
      { name: 'Tatuagem Autoral (Fechamento / Diária)', durationMinutes: 360, price: 1400 },
      { name: 'Cobertura (Cover-up) / Reforma', durationMinutes: 240, price: 950 },
      { name: 'Aplicação de Piercing em Titânio', durationMinutes: 30, price: 120 },
    ],
  },

  // 6. Clínica de Nutrição & Bem-Estar
  nutrition: {
    id: 'nutrition',
    name: 'Clínica de Nutrição & Bem-Estar',
    category: 'health',
    icon: 'Apple',
    terms: {
      business: 'Consultório de Nutrição',
      businessPlural: 'Consultórios',
      professional: 'Nutricionista',
      professionalPlural: 'Nutricionistas',
      client: 'Paciente',
      clientPlural: 'Pacientes',
      service: 'Consulta',
      servicePlural: 'Consultas',
    },
    defaultColors: {
      primary: '#10B981', // Verde Esmeralda
      secondary: '#091812',
      accent: '#A7F3D0',
    },
    layoutTheme: {
      badge: 'Nutrição Clínica & Esportiva',
      tagline: 'Saúde metabólica, planos individualizados e alta performance',
      containerClass: 'border-emerald-500/35 bg-[#06140f]/90 shadow-[0_0_45px_-10px_rgba(16,185,129,0.25)] rounded-3xl',
      fontFamily: 'font-sans',
      accentBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      backgroundAtmosphere: 'from-[#0a271c] via-[#06150f] to-[#030b08]',
      glowColor: 'rgba(16, 185, 129, 0.28)',
      palettePresets: [
        { name: 'Esmeralda Botânico', hex: '#10B981' },
        { name: 'Menta Fresco', hex: '#34D399' },
        { name: 'Verde Oliva', hex: '#84CC16' },
      ],
    },
    suggestedServices: [
      { name: 'Consulta Nutricional + Bioimpedância Completa', durationMinutes: 60, price: 280 },
      { name: 'Montagem de Plano Alimentar Esportivo', durationMinutes: 60, price: 320 },
      { name: 'Retorno e Ajuste de Metas Antropométricas', durationMinutes: 40, price: 150 },
      { name: 'Reeducação Alimentar e Longevidade', durationMinutes: 50, price: 220 },
    ],
  },

  // 7. Consultório de Psicologia & Terapias
  psychology: {
    id: 'psychology',
    name: 'Consultório de Psicologia & Terapias',
    category: 'health',
    icon: 'Brain',
    terms: {
      business: 'Consultório de Psicologia',
      businessPlural: 'Consultórios',
      professional: 'Psicólogo(a)',
      professionalPlural: 'Psicólogos',
      client: 'Paciente',
      clientPlural: 'Pacientes',
      service: 'Sessão de Psicoterapia',
      servicePlural: 'Sessões',
    },
    defaultColors: {
      primary: '#818CF8', // Índigo Lavanda
      secondary: '#0F1224',
      accent: '#C7D2FE',
    },
    layoutTheme: {
      badge: 'Psicologia Clínica & Acolhimento',
      tagline: 'Espaço seguro, sigiloso e acolhedor para o seu desenvolvimento emocional',
      containerClass: 'border-indigo-500/35 bg-[#0a0c1a]/90 shadow-[0_0_45px_-10px_rgba(129,140,248,0.24)] rounded-3xl',
      fontFamily: 'font-sans',
      accentBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      backgroundAtmosphere: 'from-[#141738] via-[#090b1c] to-[#050610]',
      glowColor: 'rgba(129, 140, 248, 0.25)',
      palettePresets: [
        { name: 'Índigo Sereno', hex: '#818CF8' },
        { name: 'Lavanda Suave', hex: '#A78BFA' },
        { name: 'Azul Pacífico', hex: '#60A5FA' },
      ],
    },
    suggestedServices: [
      { name: 'Psicoterapia Individual Adulto (50 min)', durationMinutes: 50, price: 200 },
      { name: 'Terapia de Casal', durationMinutes: 75, price: 320 },
      { name: 'Orientação Vocacional e de Carreira', durationMinutes: 50, price: 220 },
      { name: 'Psicoterapia para Adolescentes', durationMinutes: 50, price: 200 },
    ],
  },

  // 8. Studio de Pilates & Movimento
  pilates: {
    id: 'pilates',
    name: 'Studio de Pilates & Movimento',
    category: 'health',
    icon: 'Activity',
    terms: {
      business: 'Studio de Pilates',
      businessPlural: 'Studios',
      professional: 'Instrutor(a)',
      professionalPlural: 'Instrutores',
      client: 'Aluno(a)',
      clientPlural: 'Alunos',
      service: 'Aula / Sessão',
      servicePlural: 'Aulas',
    },
    defaultColors: {
      primary: '#06B6D4', // Turquesa Vitalidade
      secondary: '#07191E',
      accent: '#A5F3FC',
    },
    layoutTheme: {
      badge: 'Studio de Pilates & Reabilitação',
      tagline: 'Postura, respiração, fortalecimento do core e mobilidade profunda',
      containerClass: 'border-cyan-500/35 bg-[#051317]/90 shadow-[0_0_45px_-10px_rgba(6,182,212,0.25)] rounded-3xl',
      fontFamily: 'font-sans',
      accentBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      backgroundAtmosphere: 'from-[#082930] via-[#041418] to-[#020b0d]',
      glowColor: 'rgba(6, 182, 212, 0.28)',
      palettePresets: [
        { name: 'Turquesa Core', hex: '#06B6D4' },
        { name: 'Azul Oceano', hex: '#0284C7' },
        { name: 'Menta Zen', hex: '#2DD4BF' },
      ],
    },
    suggestedServices: [
      { name: 'Aula Experimental de Pilates', durationMinutes: 50, price: 70 },
      { name: 'Pilates em Aparelhos (Individual)', durationMinutes: 55, price: 130 },
      { name: 'Pilates Solo & Reabilitação Funcional', durationMinutes: 55, price: 110 },
      { name: 'Pilates Especial para Gestantes', durationMinutes: 55, price: 120 },
    ],
  },

  // 9. Studio de Personal Trainer & Performance
  personal_trainer: {
    id: 'personal_trainer',
    name: 'Studio de Personal Trainer & Performance',
    category: 'health',
    icon: 'Dumbbell',
    terms: {
      business: 'Studio Fitness',
      businessPlural: 'Studios',
      professional: 'Personal Trainer',
      professionalPlural: 'Treinadores',
      client: 'Aluno / Atleta',
      clientPlural: 'Alunos',
      service: 'Treino / Consultoria',
      servicePlural: 'Treinos',
    },
    defaultColors: {
      primary: '#F97316', // Laranja Energia / Fogo
      secondary: '#1E0F07',
      accent: '#FED7AA',
    },
    layoutTheme: {
      badge: 'Treinamento Individualizado & Alta Performance',
      tagline: 'Hipertrofia, queima de gordura e condicionamento cardiovascular',
      containerClass: 'border-orange-500/35 bg-[#120703]/90 shadow-[0_0_45px_-10px_rgba(249,115,22,0.28)] rounded-2xl',
      fontFamily: 'font-sans',
      accentBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
      backgroundAtmosphere: 'from-[#2d1204] via-[#140802] to-[#0a0401]',
      glowColor: 'rgba(249, 115, 22, 0.3)',
      palettePresets: [
        { name: 'Laranja Elétrico', hex: '#F97316' },
        { name: 'Amarelo Volts', hex: '#EAB308' },
        { name: 'Vermelho Força', hex: '#DC2626' },
      ],
    },
    suggestedServices: [
      { name: 'Avaliação Física Completa & Bioimpedância', durationMinutes: 60, price: 180 },
      { name: 'Treino Personalizado Individual (1h)', durationMinutes: 60, price: 120 },
      { name: 'Consultoria Fitness + Prescrição de Ficha', durationMinutes: 60, price: 250 },
    ],
  },

  // 10. Studio de Fotografia
  photography: {
    id: 'photography',
    name: 'Studio de Fotografia',
    category: 'creative',
    icon: 'Camera',
    terms: {
      business: 'Studio de Fotografia',
      businessPlural: 'Studios',
      professional: 'Fotógrafo(a)',
      professionalPlural: 'Fotógrafos',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Ensaio Fotográfico',
      servicePlural: 'Ensaios',
    },
    defaultColors: {
      primary: '#C084FC', // Violeta Studio Leica
      secondary: '#140C20',
      accent: '#E9D5FF',
    },
    layoutTheme: {
      badge: 'Estúdio Fotográfico de Retratos',
      tagline: 'Eternizando momentos com iluminação e pós-produção cinematográfica',
      containerClass: 'border-purple-500/35 bg-[#0e0717]/90 shadow-[0_0_50px_-10px_rgba(192,132,252,0.25)] rounded-[2.5rem]',
      fontFamily: 'font-serif',
      accentBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      backgroundAtmosphere: 'from-[#210f36] via-[#0f071a] to-[#08030e]',
      glowColor: 'rgba(192, 132, 252, 0.28)',
      palettePresets: [
        { name: 'Violeta Leica', hex: '#C084FC' },
        { name: 'Âmbar Golden Hour', hex: '#F59E0B' },
        { name: 'Monocromático Platina', hex: '#E2E8F0' },
      ],
    },
    suggestedServices: [
      { name: 'Ensaio Gestante em Estúdio', durationMinutes: 120, price: 650 },
      { name: 'Ensaio Newborn (Recém-nascido)', durationMinutes: 180, price: 890 },
      { name: 'Retrato Corporativo & Posicionamento', durationMinutes: 60, price: 420 },
      { name: 'Cobertura de Casamento / Evento', durationMinutes: 300, price: 2800 },
    ],
  },

  // 11. Produtora de Vídeo & Cinema
  video_production: {
    id: 'video_production',
    name: 'Produtora de Vídeo & Cinema',
    category: 'creative',
    icon: 'Video',
    terms: {
      business: 'Produtora Audiovisual',
      businessPlural: 'Produtoras',
      professional: 'Videomaker / Diretor',
      professionalPlural: 'Especialistas',
      client: 'Cliente / Empresa',
      clientPlural: 'Clientes',
      service: 'Gravação / Produção',
      servicePlural: 'Produções',
    },
    defaultColors: {
      primary: '#EC4899', // Pink Cinema 4K
      secondary: '#1A0914',
      accent: '#FDA4AF',
    },
    layoutTheme: {
      badge: 'Audiovisual & Commercial Filmmaking',
      tagline: 'Produção de conteúdo em 4K, drones e pós-produção publicitária',
      containerClass: 'border-pink-500/35 bg-[#12050d]/90 shadow-[0_0_45px_-10px_rgba(236,72,153,0.28)] rounded-2xl',
      fontFamily: 'font-mono',
      accentBg: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
      backgroundAtmosphere: 'from-[#2b0c20] via-[#14050f] to-[#0a0207]',
      glowColor: 'rgba(236, 72, 153, 0.3)',
      palettePresets: [
        { name: 'Pink Cinema', hex: '#EC4899' },
        { name: 'Vermelho Gravação', hex: '#EF4444' },
        { name: 'Azul Anamórfico', hex: '#38BDF8' },
      ],
    },
    suggestedServices: [
      { name: 'Gravação de Vídeo Institucional', durationMinutes: 180, price: 1500 },
      { name: 'Captação de Imagens Aéreas com Drone', durationMinutes: 90, price: 800 },
      { name: 'Pacote de Reels Comerciais (Gravação)', durationMinutes: 120, price: 950 },
      { name: 'Filmagem Completa de Evento Social', durationMinutes: 240, price: 2200 },
    ],
  },

  // 12. Escritório de Arquitetura & Interiores
  architecture: {
    id: 'architecture',
    name: 'Escritório de Arquitetura & Interiores',
    category: 'technical',
    icon: 'Compass',
    terms: {
      business: 'Escritório de Arquitetura',
      businessPlural: 'Escritórios',
      professional: 'Arquiteto(a) / Designer',
      professionalPlural: 'Arquitetos',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Consultoria / Reunião',
      servicePlural: 'Serviços',
    },
    defaultColors: {
      primary: '#94A3B8', // Slate Platina
      secondary: '#0F172A',
      accent: '#E2E8F0',
    },
    layoutTheme: {
      badge: 'Arquitetura Contemporânea & Interiores',
      tagline: 'Design funcional, modelagem 3D, luminotécnica e acompanhamento de obras',
      containerClass: 'border-slate-400/35 bg-[#0c121e]/90 shadow-[0_0_45px_-10px_rgba(148,163,184,0.24)] rounded-2xl',
      fontFamily: 'font-sans',
      accentBg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      backgroundAtmosphere: 'from-[#162033] via-[#0b101a] to-[#06080e]',
      glowColor: 'rgba(148, 163, 184, 0.25)',
      palettePresets: [
        { name: 'Concreto Urbano', hex: '#94A3B8' },
        { name: 'Terracota Argila', hex: '#D97706' },
        { name: 'Grafite Puro', hex: '#475569' },
      ],
    },
    suggestedServices: [
      { name: 'Visita Técnica e Levantamento no Local', durationMinutes: 90, price: 350 },
      { name: 'Consultoria de Decoração e Ambientes', durationMinutes: 60, price: 280 },
      { name: 'Apresentação de Projeto 3D e Maquete', durationMinutes: 90, price: 450 },
      { name: 'Reunião de Acompanhamento de Reforma', durationMinutes: 60, price: 200 },
    ],
  },

  // 13. Studio de Maquiagem Profissional
  makeup: {
    id: 'makeup',
    name: 'Studio de Maquiagem Profissional',
    category: 'beauty',
    icon: 'Palette',
    terms: {
      business: 'Studio de Maquiagem',
      businessPlural: 'Studios',
      professional: 'Maquiador(a)',
      professionalPlural: 'Maquiadores',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Produção / Maquiagem',
      servicePlural: 'Produções',
    },
    defaultColors: {
      primary: '#FB7185', // Rosa Pêssego / Bridal Glow
      secondary: '#1C0F16',
      accent: '#FECDD3',
    },
    layoutTheme: {
      badge: 'Makeup & Bridal Experience',
      tagline: 'Maquiagem social, noivas, formandas e automaquiagem com produtos importados',
      containerClass: 'border-[#FB7185]/35 bg-[#14070e]/90 shadow-[0_0_50px_-10px_rgba(251,113,133,0.28)] rounded-[2.5rem]',
      fontFamily: 'font-sans',
      accentBg: 'bg-[#FB7185]/15 text-[#FECDD3] border-[#FB7185]/30',
      backgroundAtmosphere: 'from-[#2b101d] via-[#14060d] to-[#0a0307]',
      glowColor: 'rgba(251, 113, 133, 0.28)',
      palettePresets: [
        { name: 'Nude Bridal', hex: '#FB7185' },
        { name: 'Ouro Dourado', hex: '#FBBF24' },
        { name: 'Rose Glamour', hex: '#F43F5E' },
      ],
    },
    suggestedServices: [
      { name: 'Maquiagem Social para Eventos', durationMinutes: 60, price: 180 },
      { name: 'Produção Completa de Noiva (com prévia)', durationMinutes: 150, price: 900 },
      { name: 'Maquiagem Formanda / Debutante', durationMinutes: 75, price: 240 },
      { name: 'Curso de Automaquiagem VIP Individual', durationMinutes: 120, price: 350 },
    ],
  },

  // 14. Oficina de Estética Automotiva
  auto_detailing: {
    id: 'auto_detailing',
    name: 'Oficina de Estética Automotiva',
    category: 'technical',
    icon: 'Car',
    terms: {
      business: 'Estética Automotiva',
      businessPlural: 'Oficinas',
      professional: 'Detailer / Técnico',
      professionalPlural: 'Profissionais',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Serviço Automotivo',
      servicePlural: 'Serviços',
    },
    defaultColors: {
      primary: '#38BDF8', // Azul Aerodinâmico / Cerâmica 9H
      secondary: '#0B1626',
      accent: '#BAE6FD',
    },
    layoutTheme: {
      badge: 'Car Detailing & Proteção Cerâmica',
      tagline: 'Polimento técnico, vitrificação 9H, lavagem detalhada e higienização profunda',
      containerClass: 'border-sky-500/35 bg-[#06101c]/95 shadow-[0_0_50px_-10px_rgba(56,189,248,0.28)] rounded-2xl',
      fontFamily: 'font-mono',
      accentBg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      backgroundAtmosphere: 'from-[#0c223d] via-[#06111f] to-[#030911]',
      glowColor: 'rgba(56, 189, 248, 0.3)',
      palettePresets: [
        { name: 'Azul Cerâmica 9H', hex: '#38BDF8' },
        { name: 'Laranja Turbo', hex: '#FB923C' },
        { name: 'Amarelo Competição', hex: '#FACC15' },
      ],
    },
    suggestedServices: [
      { name: 'Lavagem Detalhada e Higienização Técnica', durationMinutes: 90, price: 180 },
      { name: 'Polimento Comercial & Descontaminação de Pintura', durationMinutes: 180, price: 450 },
      { name: 'Vitrificação de Pintura Cerâmica 9H (Garantia 3 Anos)', durationMinutes: 240, price: 1200 },
      { name: 'Higienização Interna e Oxi-sanitização', durationMinutes: 120, price: 320 },
      { name: 'Revitalização de Plásticos e Faróis', durationMinutes: 60, price: 150 },
    ],
  },

  // 15. Ateliê de Marcenaria & Móveis Planejados
  woodwork: {
    id: 'woodwork',
    name: 'Ateliê de Marcenaria & Móveis Planejados',
    category: 'technical',
    icon: 'Hammer',
    terms: {
      business: 'Ateliê de Marcenaria',
      businessPlural: 'Marcenarias',
      professional: 'Marceneiro / Projetista',
      professionalPlural: 'Marceneiros',
      client: 'Cliente',
      clientPlural: 'Clientes',
      service: 'Visita / Projeto',
      servicePlural: 'Serviços',
    },
    defaultColors: {
      primary: '#D97706', // Âmbar Carvalho Nobre
      secondary: '#1C1107',
      accent: '#FDE68A',
    },
    layoutTheme: {
      badge: 'Marcenaria Nobre & Móveis Sob Medida',
      tagline: 'Projetos residenciais planejados, painéis ripados e ferragens de alta durabilidade',
      containerClass: 'border-amber-600/40 bg-[#140a03]/95 shadow-[0_0_50px_-10px_rgba(217,119,6,0.28)] rounded-2xl',
      fontFamily: 'font-serif',
      accentBg: 'bg-amber-600/15 text-amber-300 border-amber-600/30',
      backgroundAtmosphere: 'from-[#2c1706] via-[#140a03] to-[#0a0501]',
      glowColor: 'rgba(217, 119, 6, 0.3)',
      palettePresets: [
        { name: 'Carvalho Nobre', hex: '#D97706' },
        { name: 'Nogueira Escura', hex: '#92400E' },
        { name: 'Canela Quente', hex: '#B45309' },
      ],
    },
    suggestedServices: [
      { name: 'Visita Técnica e Medição Residencial', durationMinutes: 90, price: 150 },
      { name: 'Apresentação de Projeto 3D Sob Medida', durationMinutes: 60, price: 0 },
      { name: 'Instalação de Painéis Ripados e Móveis', durationMinutes: 240, price: 600 },
      { name: 'Manutenção e Regulagem de Ferragens', durationMinutes: 120, price: 250 },
    ],
  },

  // 16. Pet Shop & Banho e Tosa
  pet_shop: {
    id: 'pet_shop',
    name: 'Pet Shop & Banho e Tosa',
    category: 'beauty',
    icon: 'Dog',
    terms: {
      business: 'Pet Shop & Estética Animal',
      businessPlural: 'Pet Shops',
      professional: 'Tosador(a) / Groomer',
      professionalPlural: 'Tosadores',
      client: 'Tutor / Pet',
      clientPlural: 'Tutores',
      service: 'Serviço Pet',
      servicePlural: 'Serviços',
    },
    defaultColors: {
      primary: '#0EA5E9', // Azul Pet Sky
      secondary: '#081524',
      accent: '#BAE6FD',
    },
    layoutTheme: {
      badge: 'Centro de Estética & Cuidado Animal',
      tagline: 'Banho, tosa higiênica, hidratação e muito carinho com biossegurança',
      containerClass: 'border-sky-500/35 bg-[#081524]/90 shadow-[0_0_50px_-10px_rgba(14,165,233,0.28)] rounded-3xl',
      fontFamily: 'font-sans',
      accentBg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      backgroundAtmosphere: 'from-[#0a233b] via-[#071524] to-[#040c14]',
      glowColor: 'rgba(14, 165, 233, 0.28)',
      palettePresets: [
        { name: 'Azul Celeste Pet', hex: '#0EA5E9' },
        { name: 'Laranja Caramelo', hex: '#F97316' },
        { name: 'Menta Fresco', hex: '#10B981' },
      ],
    },
    suggestedServices: [
      { name: 'Banho Completo com Tosa Higiênica', durationMinutes: 45, price: 75 },
      { name: 'Tosa da Raça / Tosa Bebê Especial', durationMinutes: 60, price: 110 },
      { name: 'Hidratação de Pelagem e Desembolo', durationMinutes: 45, price: 60 },
      { name: 'Corte de Unhas e Limpeza de Ouvidos', durationMinutes: 20, price: 35 },
      { name: 'Banho Terapêutico / Dermatológico', durationMinutes: 50, price: 90 },
    ],
  },
};

export const DEFAULT_SEGMENT_ID = 'barbershop';

// Normalization alias map for common names/inputs
const SEGMENT_ALIASES: Record<string, string> = {
  // Barber aliases
  barber: 'barbershop',
  barbearia: 'barbershop',
  barber_shop: 'barbershop',
  barbershop: 'barbershop',

  // Aesthetics aliases
  estetica: 'aesthetics',
  'estética': 'aesthetics',
  aesthetics: 'aesthetics',
  clinica: 'aesthetics',
  'clínica': 'aesthetics',

  // Lash aliases
  lash: 'lash_design',
  lash_design: 'lash_design',
  sobrancelhas: 'lash_design',

  // Salon aliases
  salao: 'beauty_salon',
  'salão': 'beauty_salon',
  beauty_salon: 'beauty_salon',
  cabelereiro: 'beauty_salon',

  // Tattoo aliases
  tattoo: 'tattoo',
  tatuagem: 'tattoo',

  // Nutrition aliases
  nutrition: 'nutrition',
  nutricao: 'nutrition',
  'nutrição': 'nutrition',

  // Psychology aliases
  psychology: 'psychology',
  psicologia: 'psychology',
  terapia: 'psychology',

  // Pilates aliases
  pilates: 'pilates',

  // Personal Trainer aliases
  personal: 'personal_trainer',
  personal_trainer: 'personal_trainer',

  // Photography aliases
  photography: 'photography',
  fotografia: 'photography',
  foto: 'photography',

  // Video aliases
  video: 'video_production',
  'vídeo': 'video_production',
  video_production: 'video_production',

  // Architecture aliases
  architecture: 'architecture',
  arquitetura: 'architecture',

  // Makeup aliases
  makeup: 'makeup',
  maquiagem: 'makeup',

  // Auto detailing aliases
  auto: 'auto_detailing',
  auto_detailing: 'auto_detailing',
  detailing: 'auto_detailing',

  // Woodwork aliases
  woodwork: 'woodwork',
  marcenaria: 'woodwork',

  // Pet Shop aliases
  pet: 'pet_shop',
  pet_shop: 'pet_shop',
  petshop: 'pet_shop',
  banho_e_tosa: 'pet_shop',
  banhotosa: 'pet_shop',
  tosa: 'pet_shop',
  veterinaria: 'pet_shop',
  'veterinária': 'pet_shop'
};

export function getSegment(segmentId?: string | null): SegmentPreset {
  if (!segmentId) {
    return SEGMENTS[DEFAULT_SEGMENT_ID];
  }
  
  const normalizedKey = segmentId.trim().toLowerCase();

  if (SEGMENTS[normalizedKey]) {
    return SEGMENTS[normalizedKey];
  }

  const aliasKey = SEGMENT_ALIASES[normalizedKey];
  if (aliasKey && SEGMENTS[aliasKey]) {
    return SEGMENTS[aliasKey];
  }

  return SEGMENTS[DEFAULT_SEGMENT_ID];
}
