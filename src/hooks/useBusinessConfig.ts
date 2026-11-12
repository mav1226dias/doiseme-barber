import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { SEGMENTS, getSegment, SegmentPreset, DEFAULT_SEGMENT_ID } from '../lib/segments';
import { toast } from 'sonner';

export interface BusinessConfigContextType {
  // Current active shop business configuration
  businessType: string;
  segmentPreset: SegmentPreset;
  isLoading: boolean;
  
  // Dynamic vocabulary helpers
  terms: SegmentPreset['terms'];
  suggestedServices: SegmentPreset['suggestedServices'];
  defaultColors: SegmentPreset['defaultColors'];

  // Master Admin action: Update business_type for any given account/shop
  setBusinessTypeForShop: (shopId: string, businessType: string) => Promise<boolean>;

  // Refresh current configuration
  refreshBusinessConfig: () => Promise<void>;
}

export const BusinessConfigContext = createContext<BusinessConfigContextType | null>(null);

/**
 * Hook to consume dynamic business configuration (terminology, labels, categories)
 */
export function useBusinessConfig() {
  const context = useContext(BusinessConfigContext);
  if (!context) {
    // Graceful fallback if used outside provider
    const fallbackPreset = getSegment(DEFAULT_SEGMENT_ID);
    return {
      businessType: DEFAULT_SEGMENT_ID,
      segmentPreset: fallbackPreset,
      isLoading: false,
      terms: fallbackPreset.terms,
      suggestedServices: fallbackPreset.suggestedServices,
      defaultColors: fallbackPreset.defaultColors,
      setBusinessTypeForShop: async () => false,
      refreshBusinessConfig: async () => {},
    };
  }
  return context;
}

/**
 * Service function to update business_type for any account directly
 */
export async function updateShopBusinessType(shopId: string, businessType: string): Promise<boolean> {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/admin/master/shops/${shopId}/segment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        business_type: businessType,
        segment: businessType 
      })
    });

    if (res.ok) {
      toast.success('Tipo de negócio atualizado com sucesso!');
      return true;
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'Erro ao atualizar tipo de negócio');
      return false;
    }
  } catch (error) {
    console.error('[UPDATE_BUSINESS_TYPE_ERROR]', error);
    toast.error('Erro de conexão ao atualizar tipo de negócio');
    return false;
  }
}
