export type Store = {
  id: string;
  name: string;
  slug: string;
  store_group: string | null;
  cuisine: string | null;
  rating: number | null;
  rating_count: number | null;
  telephone: string | null;
  address: string | null;
  price_range: string | null;
  store_url: string | null;
  uber_eats_url: string | null;
  item_count: number;
};

export type MenuItem = {
  id: string;
  store_id: string;
  category: string | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  deep_link: string | null;
};

export type Promotion = {
  id: string;
  airtable_id: string;
  promo_id: string | null;
  month: string | null;
  week: string | null;
  start_date: string | null;
  end_date: string | null;
  date_range_original: string | null;
  theme: string[] | null;
  store_group: string | null;
  offer_type: string | null;
  messaging: string | null;
  mechanic: string | null;
  recommended_items: string[] | null;
  audience: string | null;
  funding_split: string | null;
  status: string | null;
  rationale: string | null;
  margin_check: string | null;
  priority: string | null;
  marketing_approval: string | null;
  operations_approval: string | null;
  synced_at: string;
};
