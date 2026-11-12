import React, { useState, useEffect, useCallback } from 'react';
import { BusinessConfigContext, BusinessConfigContextType, updateShopBusinessType } from '../hooks/useBusinessConfig';
import { getSegment, DEFAULT_SEGMENT_ID } from '../lib/segments';

export function BusinessConfigProvider({ children }: { children: React.ReactNode }) {
  const [businessType, setBusinessType] = useState<string>(DEFAULT_SEGMENT_ID);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentConfig = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/shop-info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const detectedType = data?.segment || data?.business_type || DEFAULT_SEGMENT_ID;
        setBusinessType(detectedType);
      }
    } catch (e) {
      console.warn('[BUSINESS_CONFIG_FETCH_ERR]', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentConfig();

    // Listen to token changes or custom events if switching shops
    const handleStorageChange = () => fetchCurrentConfig();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchCurrentConfig]);

  const setBusinessTypeForShop = useCallback(async (shopId: string, type: string) => {
    const success = await updateShopBusinessType(shopId, type);
    if (success) {
      // If updating current active shop, immediately apply in state
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user?.barbershopId === shopId) {
        setBusinessType(type);
      }
    }
    return success;
  }, []);

  const segmentPreset = getSegment(businessType);

  const value: BusinessConfigContextType = {
    businessType,
    segmentPreset,
    isLoading,
    terms: segmentPreset.terms,
    suggestedServices: segmentPreset.suggestedServices,
    defaultColors: segmentPreset.defaultColors,
    setBusinessTypeForShop,
    refreshBusinessConfig: fetchCurrentConfig,
  };

  return (
    <BusinessConfigContext.Provider value={value}>
      {children}
    </BusinessConfigContext.Provider>
  );
}
