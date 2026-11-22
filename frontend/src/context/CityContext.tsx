import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedCity, SUPPORTED_CITIES } from '../types/index.ts';

interface CityContextType {
  selectedCity: SupportedCity;
  setSelectedCity: (city: SupportedCity) => void;
  supportedCities: SupportedCity[];
}

const STORAGE_KEY = 'hivemart_selected_city';
const DEFAULT_CITY: SupportedCity = 'Bengaluru';

const CityContext = createContext<CityContextType | undefined>(undefined);

export const CityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCity, setSelectedCityState] = useState<SupportedCity>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_CITIES.includes(saved as SupportedCity)) {
        return saved as SupportedCity;
      }
    } catch {
      // Ignore localStorage error
    }
    return DEFAULT_CITY;
  });

  const setSelectedCity = (city: SupportedCity) => {
    setSelectedCityState(city);
    try {
      localStorage.setItem(STORAGE_KEY, city);
    } catch {
      // Ignore localStorage error
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_CITY);
      }
    } catch {
      // Ignore
    }
  }, []);

  return (
    <CityContext.Provider value={{ selectedCity, setSelectedCity, supportedCities: SUPPORTED_CITIES }}>
      {children}
    </CityContext.Provider>
  );
};

export const useCity = (): CityContextType => {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
};

