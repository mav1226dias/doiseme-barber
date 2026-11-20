import {
  getVirtualStoreFromConfig,
  type ShopStoreContext,
  type VirtualStoreCategory,
  type VirtualStoreProduct
} from './virtualStore.js';

const IMG = {
  beardOil: '/assets/store-demo/beard-oil-comb.jpg',
  beardBalm: '/assets/store-demo/beard-balm-brush.jpg',
  hairPomade: '/assets/store-demo/hair-pomade.jpg',
  hairShampoo: '/assets/store-demo/hair-shampoo-tonic.jpg',
  perfumeWoody: '/assets/store-demo/perfume-woody.jpg',
  cologneDeo: '/assets/store-demo/cologne-deodorant.jpg',
  skincare: '/assets/store-demo/skincare-charcoal.jpg',
  kitsRazor: '/assets/store-demo/barber-kit-razor.jpg',
  menswearFlat: '/assets/store-demo/menswear-flatlay.jpg',
  teeOversized: '/assets/store-demo/tee-oversized.jpg',
  hoodieCap: '/assets/store-demo/hoodie-cap.jpg',
  jacketPolo: '/assets/store-demo/jacket-polo.jpg'
};

export interface DemoCategorySeed {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface DemoProductSeed {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  featured?: boolean;
}

export const DEMO_STORE_CATEGORIES: DemoCategorySeed[] = [
  {
    id: 'cat_demo_barba',
    name: 'Cuidados com a Barba',
    description: 'Óleos, balms, shampoos e acessórios para manter a barba hidratada, macia e alinhada.',
    imageUrl: IMG.beardOil
  },
  {
    id: 'cat_demo_cabelo',
    name: 'Finalizadores & Cabelo',
    description: 'Pomadas matte, efeito brilho, pós texturizadores e tônicos profissionais de barbearia.',
    imageUrl: IMG.hairPomade
  },
  {
    id: 'cat_demo_perfumaria',
    name: 'Perfumaria Masculina',
    description: 'Fragrâncias amadeiradas, especiadas e pós-barba de alta fixação para o dia a dia.',
    imageUrl: IMG.perfumeWoody
  },
  {
    id: 'cat_demo_skincare',
    name: 'Skincare & Rosto',
    description: 'Limpeza profunda com carvão ativado, hidratação pós-barba e proteção solar toque seco.',
    imageUrl: IMG.skincare
  },
  {
    id: 'cat_demo_acessorios',
    name: 'Acessórios & Kits Presente',
    description: 'Kits presenteáveis, navalhetes em aço inox, nécessaires e utensílios premium.',
    imageUrl: IMG.kitsRazor
  },
  {
    id: 'cat_demo_vestuario',
    name: 'Vestuário Masculino',
    description: 'Peças masculinas de caimento premium: camisetas oversized, bonés, moletons, polos e jaquetas.',
    imageUrl: IMG.menswearFlat
  }
];

export const DEMO_STORE_PRODUCTS: DemoProductSeed[] = [
  // 1. Cuidados com a Barba (6 produtos)
  {
    id: 'prod_demo_01',
    categoryId: 'cat_demo_barba',
    name: 'Óleo para Barba Sândalo & Cedro 30ml',
    description: 'Blend de óleos vegetais prensados a frio que nutre os fios, elimina o ressecamento e deixa aroma amadeirado suave.',
    price: 54.9,
    stock: 18,
    imageUrl: IMG.beardOil,
    featured: true
  },
  {
    id: 'prod_demo_02',
    categoryId: 'cat_demo_barba',
    name: 'Balm Modelador de Barba Hidratação Intensa 120g',
    description: 'Controla fios rebeldes, reduz o frizz e protege a pele sob a barba sem deixar aspecto oleoso.',
    price: 49.9,
    stock: 14,
    imageUrl: IMG.beardBalm,
    featured: true
  },
  {
    id: 'prod_demo_03',
    categoryId: 'cat_demo_barba',
    name: 'Shampoo Refrescante para Barba 200ml',
    description: 'Limpeza suave com extrato de menta e pantenol que higieniza profundamente sem ressecar os fios faciais.',
    price: 42.9,
    stock: 22,
    imageUrl: IMG.hairShampoo
  },
  {
    id: 'prod_demo_04',
    categoryId: 'cat_demo_barba',
    name: 'Cera Modeladora para Bigode Extra Forte 30g',
    description: 'Fórmula com cera de abelha natural para modelar e manter o bigode alinhado ao longo de todo o dia.',
    price: 36.9,
    stock: 9,
    imageUrl: IMG.beardBalm
  },
  {
    id: 'prod_demo_05',
    categoryId: 'cat_demo_barba',
    name: 'Pente de Madeira Nogueira Antiestático',
    description: 'Dentes médios esculpidos em madeira nobre que desembaraçam a barba sem quebrar os fios nem gerar frizz.',
    price: 34.9,
    stock: 16,
    imageUrl: IMG.beardOil
  },
  {
    id: 'prod_demo_06',
    categoryId: 'cat_demo_barba',
    name: 'Escova de Barba Cerdas Naturais de Javali',
    description: 'Distribui a oleosidade natural e o óleo de barba uniformemente, esfoliando suavemente a pele.',
    price: 48.0,
    stock: 3,
    imageUrl: IMG.beardBalm
  },

  // 2. Finalizadores & Cabelo (6 produtos)
  {
    id: 'prod_demo_07',
    categoryId: 'cat_demo_cabelo',
    name: 'Pomada Modeladora Efeito Matte 100g',
    description: 'Fixação forte com acabamento 100% seco e natural. Fácil remoção no banho e sem resíduos brancos.',
    price: 49.9,
    stock: 25,
    imageUrl: IMG.hairPomade,
    featured: true
  },
  {
    id: 'prod_demo_08',
    categoryId: 'cat_demo_cabelo',
    name: 'Pomada Teia Efeito Brilho Clássico 120g',
    description: 'Ideal para penteados clássicos, pompadour e slick back com flexibilidade e brilho moderado.',
    price: 52.9,
    stock: 15,
    imageUrl: IMG.hairPomade
  },
  {
    id: 'prod_demo_09',
    categoryId: 'cat_demo_cabelo',
    name: 'Pasta Modeladora Argila Extra Forte 100g',
    description: 'Textura encorpada com argila branca para máximo controle em cabelos grossos ou volumosos.',
    price: 56.0,
    stock: 11,
    imageUrl: IMG.hairPomade
  },
  {
    id: 'prod_demo_10',
    categoryId: 'cat_demo_cabelo',
    name: 'Pó Texturizador Volumizador Instantâneo 15g',
    description: 'Entrega volume imediato e textura seca na raiz, ideal para cortes modernos e despojados.',
    price: 44.9,
    stock: 8,
    imageUrl: IMG.hairPomade
  },
  {
    id: 'prod_demo_11',
    categoryId: 'cat_demo_cabelo',
    name: 'Shampoo Anticaspa Mentolado Ice 250ml',
    description: 'Combate a oleosidade excessiva e a descamação do couro cabeludo com sensação refrescante duradoura.',
    price: 46.9,
    stock: 19,
    imageUrl: IMG.hairShampoo
  },
  {
    id: 'prod_demo_12',
    categoryId: 'cat_demo_cabelo',
    name: 'Tônico Capilar Fortalecedor Antiqueda 120ml',
    description: 'Com biotina, cafeína e extrato de alecrim para estimular o bulbo capilar e fortalecer fios finos.',
    price: 68.9,
    stock: 10,
    imageUrl: IMG.hairShampoo
  },

  // 3. Perfumaria Masculina (6 produtos)
  {
    id: 'prod_demo_13',
    categoryId: 'cat_demo_perfumaria',
    name: 'Eau de Parfum Noir Amadeirado 100ml',
    description: 'Notas de bergamota, pimenta preta, cedro e vetiver com projeção marcante e fixação prolongada.',
    price: 169.9,
    stock: 7,
    imageUrl: IMG.perfumeWoody,
    featured: true
  },
  {
    id: 'prod_demo_14',
    categoryId: 'cat_demo_perfumaria',
    name: 'Deo Colônia Couro & Especiarias 100ml',
    description: 'Assinatura olfativa sofisticada combinando couro quente, cardamomo e âmbar para uso noturno.',
    price: 129.9,
    stock: 12,
    imageUrl: IMG.cologneDeo
  },
  {
    id: 'prod_demo_15',
    categoryId: 'cat_demo_perfumaria',
    name: 'Body Splash Refrescante Citrus & Woods 200ml',
    description: 'Perfumação leve e revigorante para pós-banho, academia ou rotina intensa de trabalho.',
    price: 64.9,
    stock: 16,
    imageUrl: IMG.cologneDeo
  },
  {
    id: 'prod_demo_16',
    categoryId: 'cat_demo_perfumaria',
    name: 'Perfume Pocket Viagem Reserve 30ml',
    description: 'Frasco compacto ideal para levar na mochila, carro ou nécessaire com fragrância amadeirada intensa.',
    price: 74.9,
    stock: 14,
    imageUrl: IMG.perfumeWoody
  },
  {
    id: 'prod_demo_17',
    categoryId: 'cat_demo_perfumaria',
    name: 'Loção Pós-Barba Amadeirada Calmante 150ml',
    description: 'Acalma a pele após o barbear, fecha os poros e perfuma com notas clássicas de barbearia.',
    price: 49.9,
    stock: 13,
    imageUrl: IMG.cologneDeo
  },
  {
    id: 'prod_demo_18',
    categoryId: 'cat_demo_perfumaria',
    name: 'Desodorante Aerosol Dry Masculino 150ml',
    description: 'Proteção 48h com toque seco, sem manchas nas roupas escuras e fragrância discreta.',
    price: 29.9,
    stock: 24,
    imageUrl: IMG.cologneDeo
  },

  // 4. Skincare & Rosto (6 produtos)
  {
    id: 'prod_demo_19',
    categoryId: 'cat_demo_skincare',
    name: 'Gel de Limpeza Facial Carvão Ativado 150ml',
    description: 'Remove impurezas, poluição e excesso de oleosidade sem repuxar a pele masculina.',
    price: 47.9,
    stock: 20,
    imageUrl: IMG.skincare,
    featured: true
  },
  {
    id: 'prod_demo_20',
    categoryId: 'cat_demo_skincare',
    name: 'Esfoliante Facial Renovador Antiporos 100g',
    description: 'Microesferas naturais que previnem pelos encravados antes do barbear e renovam a textura da pele.',
    price: 45.9,
    stock: 11,
    imageUrl: IMG.skincare
  },
  {
    id: 'prod_demo_21',
    categoryId: 'cat_demo_skincare',
    name: 'Sérum Facial Hidratante com Ácido Hialurônico 30ml',
    description: 'Absorção imediata que devolve firmeza, reduz vermelhidão pós-lâmina e controla o brilho.',
    price: 79.9,
    stock: 9,
    imageUrl: IMG.skincare
  },
  {
    id: 'prod_demo_22',
    categoryId: 'cat_demo_skincare',
    name: 'Máscara Black Peel-Off Removedora de Cravos 60g',
    description: 'Desobstrui os poros da zona T e remove cravos superficiais com carvão ativado e colágeno.',
    price: 34.9,
    stock: 17,
    imageUrl: IMG.skincare
  },
  {
    id: 'prod_demo_23',
    categoryId: 'cat_demo_skincare',
    name: 'Protetor Solar Facial Masculino FPS 50 Toque Seco',
    description: 'Proteção UVA/UVB de amplo espectro com efeito matte invisível, sem deixar a pele esbranquiçada.',
    price: 69.9,
    stock: 2,
    imageUrl: IMG.skincare
  },
  {
    id: 'prod_demo_24',
    categoryId: 'cat_demo_skincare',
    name: 'Gel Área dos Olhos Cafeína Antifadiga 15ml',
    description: 'Ameniza bolsas e olheiras causadas por cansaço com aplicador refrescante de rápida absorção.',
    price: 58.9,
    stock: 8,
    imageUrl: IMG.skincare
  },

  // 5. Acessórios & Kits Presente (6 produtos)
  {
    id: 'prod_demo_25',
    categoryId: 'cat_demo_acessorios',
    name: 'Kit Barba Completo Box Presente Premium',
    description: 'Caixa rígida presenteável com Óleo para Barba, Balm Hidratante, Pente de Madeira e Pincel clássico.',
    price: 159.9,
    stock: 6,
    imageUrl: IMG.kitsRazor,
    featured: true
  },
  {
    id: 'prod_demo_26',
    categoryId: 'cat_demo_acessorios',
    name: 'Navalhete Profissional Aço Inox Preto Fosco',
    description: 'Equilíbrio ergonômico e acabamento black matte para contornos precisos de barba e pezinho.',
    price: 64.9,
    stock: 12,
    imageUrl: IMG.kitsRazor
  },
  {
    id: 'prod_demo_27',
    categoryId: 'cat_demo_acessorios',
    name: 'Nécessaire Masculina Couro Café Estruturada',
    description: 'Amplo espaço interno com forro impermeável e zíper metálico reforçado para viagens e academia.',
    price: 119.9,
    stock: 9,
    imageUrl: IMG.kitsRazor
  },
  {
    id: 'prod_demo_28',
    categoryId: 'cat_demo_acessorios',
    name: 'Pincel de Barbear Cabo Madeira Nogueira',
    description: 'Gera espuma densa e cremosa levantando os fios para um barbear muito mais rente e confortável.',
    price: 59.9,
    stock: 7,
    imageUrl: IMG.kitsRazor
  },
  {
    id: 'prod_demo_29',
    categoryId: 'cat_demo_acessorios',
    name: 'Kit Viagem Essencial Cabelo & Barba (3 itens)',
    description: 'Versão prática com Shampoo 2 em 1, Pomada Matte 50g e Óleo para Barba 15ml em estojo compacto.',
    price: 94.9,
    stock: 10,
    imageUrl: IMG.kitsRazor
  },
  {
    id: 'prod_demo_30',
    categoryId: 'cat_demo_acessorios',
    name: 'Caixa Presente Edição Limitada Barber Club',
    description: 'Edição especial colecionável com Eau de Parfum 30ml, Navalhete Inox e Balm Hidratante.',
    price: 219.9,
    stock: 0,
    imageUrl: IMG.kitsRazor
  },

  // 6. Vestuário Masculino (5 peças masculinas)
  {
    id: 'prod_demo_31',
    categoryId: 'cat_demo_vestuario',
    name: 'Camiseta Oversized Heavyweight Preta',
    description: 'Malha 100% algodão penteado 240g/m², gola ribana reforçada e modelagem ampla contemporânea (P ao GG).',
    price: 119.9,
    stock: 15,
    imageUrl: IMG.teeOversized,
    featured: true
  },
  {
    id: 'prod_demo_32',
    categoryId: 'cat_demo_vestuario',
    name: 'Boné Dad Hat Sarja Premium Preto',
    description: 'Aba curva estruturada em sarja 100% algodão com fecho metálico ajustável e acabamento minimalista.',
    price: 89.9,
    stock: 12,
    imageUrl: IMG.hoodieCap
  },
  {
    id: 'prod_demo_33',
    categoryId: 'cat_demo_vestuario',
    name: 'Moletom Canguru Heavyweight Grafite',
    description: 'Moletom 3 cabos peluciado por dentro, capuz forrado e punhos estruturados para máximo conforto.',
    price: 229.9,
    stock: 6,
    imageUrl: IMG.hoodieCap,
    featured: true
  },
  {
    id: 'prod_demo_34',
    categoryId: 'cat_demo_vestuario',
    name: 'Camisa Polo Piquet Classic Preta',
    description: 'Tecido piquet respirável com toque macio, gola firme e corte slim moderno para ocasiões casuais.',
    price: 139.9,
    stock: 9,
    imageUrl: IMG.jacketPolo
  },
  {
    id: 'prod_demo_35',
    categoryId: 'cat_demo_vestuario',
    name: 'Jaqueta Corta-Vento Street Preto Fosco',
    description: 'Tecido leve repelente à água com zíper tratorado, bolsos laterais com zíper e caimento urbano.',
    price: 249.9,
    stock: 4,
    imageUrl: IMG.jacketPolo
  }
];

export function buildDemoVirtualStoreConfig(
  rawConfig: Record<string, any> | null | undefined,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const existingStore = getVirtualStoreFromConfig(base, shop);

  const categories: VirtualStoreCategory[] = DEMO_STORE_CATEGORIES.map((c, idx) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    active: true,
    order: idx,
    createdAt: nowIso,
    updatedAt: nowIso
  }));

  const products: VirtualStoreProduct[] = DEMO_STORE_PRODUCTS.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    imageUrl: p.imageUrl,
    active: true,
    featured: Boolean(p.featured),
    createdAt: nowIso,
    updatedAt: nowIso
  }));

  base._virtualStore = {
    layout: {
      ...existingStore.layout,
      enabled: true,
      showPublicButton: true
    },
    categories,
    products,
    _demoSeeded: true,
    updatedAt: nowIso
  };

  return base;
}
