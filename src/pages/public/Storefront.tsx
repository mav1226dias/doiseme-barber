import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  Plus,
  Minus,
  X,
  MessageCircle,
  Search,
  Store,
  Package,
  Trash2
} from 'lucide-react';
import {
  formatBRL,
  isLightHex,
  type VirtualStoreCategory,
  type VirtualStoreLayout,
  type VirtualStoreProduct
} from '../../lib/virtualStore';

interface PublicStoreResponse {
  shop: {
    id: string;
    name: string;
    slug: string;
    whatsapp: string;
  };
  layout: VirtualStoreLayout;
  categories: VirtualStoreCategory[];
  products: VirtualStoreProduct[];
}

interface CartItem {
  product: VirtualStoreProduct;
  quantity: number;
}

export default function Storefront() {
  const { slug } = useParams();
  const [data, setData] = useState<PublicStoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; details: string } | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!slug) {
      setError({ title: 'Loja não encontrada', details: 'O endereço informado está incompleto.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/public/shop/${slug}/store?t=${Date.now()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError({
            title: json?.error || 'Loja virtual indisponível',
            details: json?.details || 'A loja virtual ainda não foi publicada para este estabelecimento.'
          });
          return null;
        }
        return json as PublicStoreResponse;
      })
      .then((payload) => {
        if (payload) setData(payload);
      })
      .catch(() => {
        setError({
          title: 'Erro ao carregar loja',
          details: 'Verifique sua conexão e tente novamente.'
        });
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.categories || []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [data?.categories]);

  const filteredProducts = useMemo(() => {
    const list = data?.products || [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [data?.products, selectedCategory, searchQuery]);

  const totalItemsInCart = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [cart]
  );

  const addToCart = (product: VirtualStoreProduct) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + 1);
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: nextQty } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = Math.min(item.product.stock, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleMarkImageBroken = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6 gap-3 text-gray-500">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        <span className="text-sm font-medium">Carregando loja virtual...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
          <Store className="w-7 h-7 text-white/50" />
        </div>
        <h1 className="text-2xl font-bold font-serif mb-2">{error?.title || 'Loja indisponível'}</h1>
        <p className="text-sm text-white/60 max-w-sm mb-6">
          {error?.details || 'Não foi possível localizar esta loja virtual.'}
        </p>
        {slug && (
          <Link
            to={`/b/${slug}`}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a página do estabelecimento</span>
          </Link>
        )}
      </div>
    );
  }

  const { layout, categories, products, shop } = data;
  const bgIsLight = isLightHex(layout.backgroundColor);
  const primaryIsLight = isLightHex(layout.primaryColor);
  const primaryTextColor = primaryIsLight ? '#111827' : '#FFFFFF';
  const borderSubtle = bgIsLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.12)';
  const mutedTextStyle = { color: layout.textColor, opacity: 0.68 };

  const buildWhatsappOrderUrl = () => {
    const cleanPhone = (shop.whatsapp || '').replace(/\D/g, '');
    const fullPhone = cleanPhone
      ? cleanPhone.startsWith('55')
        ? cleanPhone
        : `55${cleanPhone}`
      : '';
    const lines = [
      `Olá! Gostaria de fazer um pedido na loja *${layout.storeName || shop.name}*:`,
      '',
      ...cart.map(
        (item) =>
          `- ${item.quantity}x ${item.product.name} (${formatBRL(item.product.price * item.quantity)})`
      ),
      '',
      `*Total:* ${formatBRL(cartSubtotal)}`
    ];
    if (customerName.trim()) lines.push(`*Nome:* ${customerName.trim()}`);
    if (customerNotes.trim()) lines.push(`*Observação:* ${customerNotes.trim()}`);
    const text = encodeURIComponent(lines.join('\n'));
    return fullPhone ? `https://wa.me/${fullPhone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden transition-colors"
      style={{ backgroundColor: layout.backgroundColor, color: layout.textColor }}
    >
      {/* Top Bar Contract: Brand — Nav Links — Primary Cart Action */}
      <header
        className="sticky top-0 z-30 w-full border-b backdrop-blur-md"
        style={{
          backgroundColor: bgIsLight ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,12,0.88)',
          borderColor: borderSubtle
        }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-2.5 flex-1 md:flex-initial min-w-0">
            {layout.logoUrl && !brokenImages['logo'] ? (
              <img
                src={layout.logoUrl}
                alt={layout.storeName || shop.name}
                referrerPolicy="no-referrer"
                onError={() => handleMarkImageBroken('logo')}
                className="w-9 h-9 rounded-lg object-contain border p-0.5 shrink-0"
                style={{ borderColor: borderSubtle, backgroundColor: layout.surfaceColor }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: layout.surfaceColor }}
              >
                <Store className="w-4 h-4" style={{ color: layout.primaryColor }} />
              </div>
            )}
            <span className="text-sm sm:text-lg font-bold font-serif tracking-tight truncate">
              {layout.storeName || shop.name}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium shrink-0">
            {categories.length > 0 && (
              <a
                href="#categorias"
                className="hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                style={mutedTextStyle}
              >
                Categorias
              </a>
            )}
            <a
              href="#catalogo"
              className="hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              style={mutedTextStyle}
            >
              Produtos
            </a>
            <Link
              to={`/b/${shop.slug}`}
              className="hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              style={mutedTextStyle}
            >
              Agendar horário
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to={`/b/${shop.slug}`}
              className="md:hidden min-h-[40px] inline-flex items-center gap-1 px-2 py-2 text-xs font-medium whitespace-nowrap shrink-0"
              style={mutedTextStyle}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Agenda</span>
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Abrir sacola com ${totalItemsInCart} ${totalItemsInCart === 1 ? 'item' : 'itens'}`}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: layout.primaryColor, color: primaryTextColor }}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Sacola</span>
              <span className="font-mono tabular-nums">({totalItemsInCart})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">
        {/* Banner opcional da loja (sem bloco grande de texto) */}
        {layout.bannerUrl && !brokenImages['banner'] && (
          <div
            className="rounded-2xl border overflow-hidden max-h-[260px] sm:max-h-[320px]"
            style={{ borderColor: borderSubtle }}
          >
            <img
              src={layout.bannerUrl}
              alt={`Banner de ${layout.storeName || shop.name}`}
              referrerPolicy="no-referrer"
              onError={() => handleMarkImageBroken('banner')}
              className="w-full h-44 sm:h-64 object-cover"
            />
          </div>
        )}

        {/* Categorias com demonstração visual */}
        {categories.length > 0 && (
          <section id="categorias" className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-serif">Categorias</h2>
                <p className="text-xs sm:text-sm mt-0.5" style={mutedTextStyle}>
                  Explore os produtos por categoria
                </p>
              </div>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-semibold underline underline-offset-4"
                  style={{ color: layout.primaryColor }}
                >
                  Mostrar todas as categorias
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory((prev) => (prev === cat.id ? 'all' : cat.id))
                    }
                    className="group text-left rounded-2xl border overflow-hidden transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: layout.surfaceColor,
                      borderColor: isSelected ? layout.primaryColor : borderSubtle,
                      boxShadow: isSelected ? `0 0 0 1px ${layout.primaryColor}` : undefined
                    }}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center relative bg-black/5">
                      {cat.imageUrl && !brokenImages[`cat-${cat.id}`] ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          onError={() => handleMarkImageBroken(`cat-${cat.id}`)}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 opacity-40">
                          <Store className="w-7 h-7" />
                        </div>
                      )}
                    </div>
                    <div className="p-3.5 space-y-0.5">
                      <div className="text-sm font-bold truncate">{cat.name}</div>
                      <div className="text-xs tabular-nums" style={mutedTextStyle}>
                        {count} {count === 1 ? 'produto' : 'produtos'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Catálogo de Produtos */}
        <section id="catalogo" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif">
                {selectedCategory === 'all'
                  ? 'Catálogo de produtos'
                  : categoryNameMap.get(selectedCategory) || 'Produtos'}
              </h2>
              <p className="text-xs sm:text-sm mt-0.5 tabular-nums" style={mutedTextStyle}>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'item disponível' : 'itens disponíveis'}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50"
                style={{ color: layout.textColor }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: layout.surfaceColor,
                  borderColor: borderSubtle,
                  color: layout.textColor
                }}
              />
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div
              className="rounded-2xl border p-12 text-center space-y-2"
              style={{ backgroundColor: layout.surfaceColor, borderColor: borderSubtle }}
            >
              <Package className="w-8 h-8 mx-auto opacity-40" />
              <h3 className="text-base font-bold">Nenhum produto disponível</h3>
              <p className="text-xs sm:text-sm max-w-sm mx-auto" style={mutedTextStyle}>
                {products.length === 0
                  ? 'Os produtos desta loja virtual estão sendo preparados e aparecerão aqui em breve.'
                  : 'Nenhum produto corresponde ao filtro atual.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const catName = product.categoryId
                  ? categoryNameMap.get(product.categoryId)
                  : null;
                const inCart = cart.find((i) => i.product.id === product.id)?.quantity || 0;
                const outOfStock = product.stock <= 0;
                const reachedMax = inCart >= product.stock;

                return (
                  <article
                    key={product.id}
                    className="rounded-2xl border overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: layout.surfaceColor,
                      borderColor: borderSubtle
                    }}
                  >
                    <div>
                      <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center bg-black/5">
                        {product.imageUrl && !brokenImages[`prod-${product.id}`] ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            onError={() => handleMarkImageBroken(`prod-${product.id}`)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 opacity-35">
                            <Package className="w-8 h-8 mb-1" />
                            <span className="text-xs">Sem imagem</span>
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-center gap-2 text-xs" style={mutedTextStyle}>
                          {catName && <span>{catName}</span>}
                          {catName && <span aria-hidden="true">·</span>}
                          <span className="tabular-nums">
                            {outOfStock
                              ? 'Esgotado'
                              : product.stock <= 3
                                ? `Últimas ${product.stock} un.`
                                : `${product.stock} em estoque`}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold leading-snug">
                          {product.name}
                        </h3>

                        {product.description && (
                          <p className="text-xs sm:text-sm leading-relaxed line-clamp-3" style={mutedTextStyle}>
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      className="px-5 py-4 border-t flex items-center justify-between gap-3"
                      style={{ borderColor: borderSubtle }}
                    >
                      <div className="text-base font-bold tabular-nums">
                        {formatBRL(product.price)}
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock || reachedMax}
                        onClick={() => addToCart(product)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                        style={{
                          backgroundColor: outOfStock ? borderSubtle : layout.primaryColor,
                          color: outOfStock ? layout.textColor : primaryTextColor
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {outOfStock
                            ? 'Esgotado'
                            : reachedMax
                              ? 'Limite na sacola'
                              : inCart > 0
                                ? `Na sacola (${inCart})`
                                : 'Adicionar'}
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer
        className="border-t mt-16 py-8 px-4 text-center text-xs"
        style={{ borderColor: borderSubtle, ...mutedTextStyle }}
      >
        <p>
          {layout.storeName || shop.name} · Loja virtual oficial
        </p>
      </footer>

      {/* Drawer da Sacola */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
            onClick={() => setCartOpen(false)}
          />
          <aside
            aria-label="Sacola de compras"
            className="relative z-10 w-full max-w-md h-full flex flex-col border-l shadow-2xl"
            style={{
              backgroundColor: layout.backgroundColor,
              color: layout.textColor,
              borderColor: borderSubtle
            }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: borderSubtle }}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" style={{ color: layout.primaryColor }} />
                <h2 className="text-base font-bold font-serif">
                  Sua sacola ({totalItemsInCart})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Fechar sacola"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:opacity-75"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-sm font-semibold">Sua sacola está vazia</p>
                  <p className="text-xs" style={mutedTextStyle}>
                    Adicione produtos do catálogo para montar seu pedido.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {cart.map(({ product, quantity }) => (
                      <li
                        key={product.id}
                        className="p-3.5 rounded-xl border flex items-center gap-3"
                        style={{ backgroundColor: layout.surfaceColor, borderColor: borderSubtle }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{product.name}</div>
                          <div className="text-xs tabular-nums mt-0.5" style={mutedTextStyle}>
                            {formatBRL(product.price)} un. · Subtotal {formatBRL(product.price * quantity)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(product.id, -1)}
                            aria-label={`Remover uma unidade de ${product.name}`}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center"
                            style={{ borderColor: borderSubtle }}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            disabled={quantity >= product.stock}
                            onClick={() => updateCartQuantity(product.id, 1)}
                            aria-label={`Adicionar uma unidade de ${product.name}`}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-35"
                            style={{ borderColor: borderSubtle }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCartItem(product.id)}
                            aria-label={`Excluir ${product.name} da sacola`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label htmlFor="cart-name" className="block text-xs font-semibold mb-1">
                        Seu nome (opcional)
                      </label>
                      <input
                        id="cart-name"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Como podemos te chamar?"
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl border text-sm focus:outline-none"
                        style={{
                          backgroundColor: layout.surfaceColor,
                          borderColor: borderSubtle,
                          color: layout.textColor
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="cart-notes" className="block text-xs font-semibold mb-1">
                        Observações (retirada ou entrega)
                      </label>
                      <textarea
                        id="cart-notes"
                        rows={2}
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="Ex: Retiro no meu próximo horário"
                        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                        style={{
                          backgroundColor: layout.surfaceColor,
                          borderColor: borderSubtle,
                          color: layout.textColor
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div
                className="p-5 border-t space-y-3"
                style={{ borderColor: borderSubtle }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span style={mutedTextStyle}>Subtotal</span>
                  <span className="text-lg font-bold tabular-nums">{formatBRL(cartSubtotal)}</span>
                </div>
                <a
                  href={buildWhatsappOrderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: layout.primaryColor, color: primaryTextColor }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar pedido pelo WhatsApp</span>
                </a>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
