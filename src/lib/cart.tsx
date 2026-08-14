import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type CartItem = {
  product_id: string;
  name: any;
  image: string;
  price: number;
  qty: number;
  stock: number;
  seller_id: string;
  shop_name?: string;
  variation?: string | null;
};

type Ctx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (product_id: string, variation: string | null | undefined, qty: number) => void;
  remove: (product_id: string, variation?: string | null) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<Ctx>({} as Ctx);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage.getItem("cart", "[]").then((v) => {
      try {
        setItems(JSON.parse((v as string) || "[]"));
      } catch {}
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) storage.setItem("cart", JSON.stringify(items));
  }, [items, loaded]);

  const key = (id: string, v?: string | null) => `${id}|${v || ""}`;

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => key(i.product_id, i.variation) === key(item.product_id, item.variation));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(next[idx].qty + qty, item.stock) };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
  }, []);

  const setQty = useCallback((id: string, v: string | null | undefined, qty: number) => {
    setItems((prev) => prev.map((i) => (key(i.product_id, i.variation) === key(id, v) ? { ...i, qty } : i)).filter((i) => i.qty > 0));
  }, []);

  const remove = useCallback((id: string, v?: string | null) => {
    setItems((prev) => prev.filter((i) => key(i.product_id, i.variation) !== key(id, v)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  return <CartContext.Provider value={{ items, add, setQty, remove, clear, count, subtotal }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
