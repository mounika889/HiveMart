import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Cart, CartContextType } from '../types/index.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useCity } from './CityContext.tsx';
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../services/cart.ts';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { selectedCity } = useCity();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [mutationPending, setMutationPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch cart from backend whenever auth or delivery city changes
  const fetchCart = useCallback(
    async (showLoading = true) => {
      if (!isAuthenticated) {
        setCart(null);
        setError(null);
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const data = await getCart(selectedCity);
        setCart(data);
      } catch (err: any) {
        console.warn('Failed to load user cart:', err);
        setError(err instanceof Error ? err.message : 'Unable to load shopping cart.');
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [isAuthenticated, selectedCity]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart(true);
    } else {
      setCart(null);
      setError(null);
      setLoading(false);
    }
  }, [isAuthenticated, selectedCity, fetchCart]);

  // Add item with automatic merge if item is already in cart
  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      if (!isAuthenticated) {
        throw new Error('AUTH_REQUIRED');
      }

      setMutationPending(true);
      setError(null);

      try {
        const existingItem = cart?.items?.find((i) => i.product_id === productId);
        let updatedCart: Cart;

        if (existingItem) {
          // If already in cart, increment quantity rather than triggering 409 conflict
          const newQty = existingItem.quantity + quantity;
          updatedCart = await updateCartItem(productId, newQty, selectedCity);
        } else {
          updatedCart = await addCartItem(productId, quantity, selectedCity);
        }

        setCart(updatedCart);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : 'Failed to add item to cart.';
        setError(msg);
        throw err;
      } finally {
        setMutationPending(false);
      }
    },
    [isAuthenticated, cart, selectedCity]
  );

  // Update quantity or remove if quantity reaches 0
  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (!isAuthenticated) return;

      setMutationPending(true);
      setError(null);

      try {
        if (quantity <= 0) {
          await removeCartItem(productId);
          const freshCart = await getCart(selectedCity);
          setCart(freshCart);
        } else {
          const updatedCart = await updateCartItem(productId, quantity, selectedCity);
          setCart(updatedCart);
        }
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : 'Failed to update item quantity.';
        setError(msg);
        throw err;
      } finally {
        setMutationPending(false);
      }
    },
    [isAuthenticated, selectedCity]
  );

  // Remove a specific line item
  const removeItem = useCallback(
    async (productId: string) => {
      if (!isAuthenticated) return;

      setMutationPending(true);
      setError(null);

      try {
        await removeCartItem(productId);
        const freshCart = await getCart(selectedCity);
        setCart(freshCart);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : 'Failed to remove item from cart.';
        setError(msg);
        throw err;
      } finally {
        setMutationPending(false);
      }
    },
    [isAuthenticated, selectedCity]
  );

  // Clear entire cart
  const clear = useCallback(async () => {
    if (!isAuthenticated) return;

    setMutationPending(true);
    setError(null);

    try {
      await clearCart();
      setCart((prev) =>
        prev
          ? {
              ...prev,
              items: [],
              total_items: 0,
              total_amount: '0.00',
            }
          : null
      );
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to clear cart.';
      setError(msg);
      throw err;
    } finally {
      setMutationPending(false);
    }
  }, [isAuthenticated]);

  const refreshCart = useCallback(async () => {
    await fetchCart(false);
  }, [fetchCart]);

  const totalItems = useMemo(() => {
    if (!isAuthenticated || !cart) return 0;
    return cart.items?.reduce((sum, item) => sum + item.quantity, 0) ?? cart.total_items ?? 0;
  }, [isAuthenticated, cart]);

  const totalAmount = useMemo(() => {
    if (!isAuthenticated || !cart) return '0.00';
    return cart.total_amount || '0.00';
  }, [isAuthenticated, cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        totalItems,
        totalAmount,
        loading,
        mutationPending,
        error,
        addItem,
        updateQuantity,
        removeItem,
        clear,
        refreshCart,
        clearError,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

