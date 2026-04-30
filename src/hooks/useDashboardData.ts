import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Store, MenuItem, Promotion } from "@/types";

export const usePromotions = () =>
  useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Promotion[];
    },
  });

export const useStores = () =>
  useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").order("name");
      if (error) throw error;
      return data as Store[];
    },
  });

export const useStoreBySlug = (slug: string | undefined) =>
  useQuery({
    queryKey: ["store", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      return data as Store | null;
    },
  });

export const useStoreItems = (storeId: string | undefined) =>
  useQuery({
    queryKey: ["items", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("store_id", storeId!)
        .order("category")
        .order("name");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

// All items joined w/ store info, paginated by fetching all (2780 rows) in chunks
export const useAllItems = () =>
  useQuery({
    queryKey: ["all-items"],
    queryFn: async () => {
      const all: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id, store_id, category, name, description, price, currency, stores!inner(name, slug, store_group)")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }
      return all as Array<MenuItem & { stores: { name: string; slug: string; store_group: string | null } }>;
    },
  });

export const useUploads = () =>
  useQuery({
    queryKey: ["uploads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uploads").select("*").order("uploaded_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });
