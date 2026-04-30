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
