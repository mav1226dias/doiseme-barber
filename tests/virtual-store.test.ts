import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STORE_BUTTON_LABEL,
  adjustStoreProductStock,
  canAccessVirtualStorePanel,
  deleteStoreCategory,
  deleteStoreProduct,
  getPublicStoreSummary,
  getPublicStorefrontPayload,
  getVirtualStoreFromConfig,
  parseVirtualStoreEnabledShops,
  parseVirtualStoreRolloutFlag,
  updateVirtualStoreLayout,
  upsertStoreCategory,
  upsertStoreProduct
} from '../src/lib/virtualStore.js';
import {
  applyOnboardingPatch,
  mergeSettingsPreservingMetadata
} from '../src/lib/onboarding.js';

const mockShop = {
  id: 'shop-master-1',
  name: 'Studio Doiseme',
  slug: 'studio-doiseme',
  primary_color: '#D4AF37',
  whatsapp: '11999998888'
};

describe('Loja Virtual — Configuração de Layout e Botão Opcional Público', () => {
  it('inicia desativada por padrão com rótulo "Acessar a loja virtual"', () => {
    const store = getVirtualStoreFromConfig({}, mockShop);
    assert.equal(store.layout.enabled, false);
    assert.equal(store.layout.showPublicButton, false);
    assert.equal(store.layout.buttonLabel, DEFAULT_STORE_BUTTON_LABEL);

    const summary = getPublicStoreSummary({}, mockShop);
    assert.equal(summary.enabled, false);
    assert.equal(summary.showPublicButton, false);
  });

  it('salva logo, banner, cores e controla exibição opcional do botão na página pública', () => {
    let rawConfig: Record<string, any> = {};
    rawConfig = updateVirtualStoreLayout(
      rawConfig,
      {
        enabled: true,
        showPublicButton: true,
        buttonLabel: 'Acessar a loja virtual',
        storeName: 'Loja Oficial Doiseme',
        logoUrl: '/uploads/logo-loja.png',
        bannerUrl: '/uploads/banner-loja.jpg',
        primaryColor: '#10b981',
        backgroundColor: '#0f172a',
        surfaceColor: '#1e293b',
        textColor: '#f8fafc'
      },
      mockShop
    );

    const store = getVirtualStoreFromConfig(rawConfig, mockShop);
    assert.equal(store.layout.enabled, true);
    assert.equal(store.layout.showPublicButton, true);
    assert.equal(store.layout.logoUrl, '/uploads/logo-loja.png');
    assert.equal(store.layout.primaryColor, '#10B981');
    assert.equal(store.layout.backgroundColor, '#0F172A');

    const summary = getPublicStoreSummary(rawConfig, mockShop);
    assert.equal(summary.showPublicButton, true);
    assert.equal(summary.buttonLabel, 'Acessar a loja virtual');

    // Desativar botão opcional mantém a loja ativa mas oculta o botão da página pública
    rawConfig = updateVirtualStoreLayout(rawConfig, { showPublicButton: false }, mockShop);
    const summaryNoBtn = getPublicStoreSummary(rawConfig, mockShop);
    assert.equal(summaryNoBtn.enabled, true);
    assert.equal(summaryNoBtn.showPublicButton, false);
  });
});

describe('Loja Virtual — Categorias com foto e Produtos com estoque/valores', () => {
  it('cadastra categoria com foto visual, vincula produto completo e preserva produto ao excluir categoria', () => {
    let rawConfig: Record<string, any> = {};

    const catRes = upsertStoreCategory(
      rawConfig,
      {
        name: 'Cuidados Capilares',
        description: 'Linha profissional para manutenção em casa',
        imageUrl: '/uploads/cat-capilar.webp'
      },
      null,
      mockShop
    );
    rawConfig = catRes.nextConfig;
    assert.equal(catRes.category.name, 'Cuidados Capilares');
    assert.equal(catRes.category.imageUrl, '/uploads/cat-capilar.webp');

    const prodRes = upsertStoreProduct(
      rawConfig,
      {
        name: 'Pomada Matte 100g',
        description: 'Fixação seca de longa duração',
        price: 59.9,
        stock: 12,
        imageUrl: '/uploads/pomada.jpg',
        categoryId: catRes.category.id
      },
      null,
      mockShop
    );
    rawConfig = prodRes.nextConfig;
    assert.equal(prodRes.product.name, 'Pomada Matte 100g');
    assert.equal(prodRes.product.price, 59.9);
    assert.equal(prodRes.product.stock, 12);
    assert.equal(prodRes.product.imageUrl, '/uploads/pomada.jpg');
    assert.equal(prodRes.product.categoryId, catRes.category.id);

    // Ajuste rápido de estoque não fica negativo
    rawConfig = adjustStoreProductStock(rawConfig, prodRes.product.id, -5, mockShop).nextConfig;
    assert.equal(getVirtualStoreFromConfig(rawConfig, mockShop).products[0].stock, 7);

    rawConfig = adjustStoreProductStock(rawConfig, prodRes.product.id, -99, mockShop).nextConfig;
    assert.equal(getVirtualStoreFromConfig(rawConfig, mockShop).products[0].stock, 0);

    // Excluir categoria desvincula produto sem apagá-lo
    rawConfig = deleteStoreCategory(rawConfig, catRes.category.id, mockShop);
    const afterDelCat = getVirtualStoreFromConfig(rawConfig, mockShop);
    assert.equal(afterDelCat.categories.length, 0);
    assert.equal(afterDelCat.products.length, 1);
    assert.equal(afterDelCat.products[0].categoryId, null);

    // Excluir produto
    rawConfig = deleteStoreProduct(rawConfig, prodRes.product.id, mockShop);
    assert.equal(getVirtualStoreFromConfig(rawConfig, mockShop).products.length, 0);
  });

  it('rejeita preço negativo ou estoque inválido', () => {
    assert.throws(() =>
      upsertStoreProduct({}, { name: 'Item', price: -10, stock: 5 }, null, mockShop)
    );
    assert.throws(() =>
      upsertStoreProduct({}, { name: 'Item', price: 20, stock: -1 }, null, mockShop)
    );
    assert.throws(() =>
      upsertStoreProduct({}, { name: 'Item', price: 20, stock: 2.5 }, null, mockShop)
    );
  });

  it('preserva _virtualStore ao salvar horários ou atualizar onboarding', () => {
    let rawConfig: Record<string, any> = {};
    rawConfig = updateVirtualStoreLayout(rawConfig, { enabled: true, showPublicButton: true }, mockShop);
    rawConfig = upsertStoreProduct(
      rawConfig,
      { name: 'Óleo para Barba', description: 'Hidratação intensa', price: 45, stock: 8, imageUrl: '/uploads/oleo.png' },
      null,
      mockShop
    ).nextConfig;

    // Salvar horários em /api/admin/settings não pode apagar _virtualStore
    rawConfig = mergeSettingsPreservingMetadata(rawConfig, {
      monday: { open: '09:00', close: '19:00', isClosed: false }
    });
    // Atualizar onboarding também não pode apagar _virtualStore
    rawConfig = applyOnboardingPatch(rawConfig, { nicheConfirmed: true });

    const payload = getPublicStorefrontPayload(rawConfig, mockShop);
    assert.equal(payload.layout.enabled, true);
    assert.equal(payload.products.length, 1);
    assert.equal(payload.products[0].name, 'Óleo para Barba');
  });
});

describe('Loja Virtual — Liberação pelo Painel Master por estabelecimento específico', () => {
  it('interpreta flag global e lista de estabelecimentos liberados com segurança', () => {
    assert.equal(parseVirtualStoreRolloutFlag(null), false);
    assert.equal(parseVirtualStoreRolloutFlag('false'), false);
    assert.equal(parseVirtualStoreRolloutFlag('true'), true);

    assert.deepEqual(parseVirtualStoreEnabledShops(null), []);
    assert.deepEqual(parseVirtualStoreEnabledShops('invalido'), []);
    assert.deepEqual(
      parseVirtualStoreEnabledShops(JSON.stringify(['shop-2', 'shop-5', 'shop-2', ''])),
      ['shop-2', 'shop-5']
    );
  });

  it('libera acesso apenas aos estabelecimentos escolhidos (e sempre ao Master)', () => {
    const enabledShopIds = ['shop-2'];

    // Master sempre acessa
    assert.equal(
      canAccessVirtualStorePanel({ role: 'master', barbershopId: 'shop-1', enabledForAll: false, enabledShopIds }),
      true
    );

    // Estabelecimento específico liberado acessa
    assert.equal(
      canAccessVirtualStorePanel({ role: 'admin', barbershopId: 'shop-2', enabledForAll: false, enabledShopIds }),
      true
    );

    // Outro estabelecimento não listado continua bloqueado
    assert.equal(
      canAccessVirtualStorePanel({ role: 'admin', barbershopId: 'shop-3', enabledForAll: false, enabledShopIds }),
      false
    );

    // Profissional (barber) nunca acessa mesmo que o estabelecimento esteja liberado
    assert.equal(
      canAccessVirtualStorePanel({ role: 'barber', barbershopId: 'shop-2', enabledForAll: false, enabledShopIds }),
      false
    );

    // Liberação global opcional libera outros admins
    assert.equal(
      canAccessVirtualStorePanel({ role: 'admin', barbershopId: 'shop-3', enabledForAll: true, enabledShopIds: [] }),
      true
    );
  });
});

