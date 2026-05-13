import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStores } from "@/hooks/useDashboardData";
import { Star, MapPin, Phone, Search, ExternalLink } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Stores() {
  usePageMeta({ title: "Stores · Col'Cacchio Dashboard", description: "Browse and search every Col'Cacchio store with location, contact, and rating details." });
  const { data: stores, isLoading } = useStores();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const groups = useMemo(() => {
    if (!stores) return [];
    return Array.from(new Set(stores.map((s) => s.store_group).filter(Boolean))) as string[];
  }, [stores]);

  const filtered = useMemo(() => {
    if (!stores) return [];
    let r = stores.filter((s) => {
      const ql = q.toLowerCase();
      const matchQ = !q || s.name.toLowerCase().includes(ql) || (s.address ?? "").toLowerCase().includes(ql);
      const matchG = group === "all" || s.store_group === group;
      return matchQ && matchG;
    });
    if (sortBy === "rating") r = [...r].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sortBy === "items") r = [...r].sort((a, b) => b.item_count - a.item_count);
    else r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [stores, q, group, sortBy]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
        <p className="text-muted-foreground text-sm">{stores?.length ?? "—"} locations across South Africa.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search stores by name or address" placeholder="Search by name or address..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="rating">Sort: Rating</SelectItem>
            <SelectItem value="items">Sort: Item count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Link key={s.id} to={`/stores/${s.slug}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md group-hover:border-primary/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors">{s.name}</h3>
                    {s.rating != null && (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <Star className="h-3 w-3 fill-current text-primary" /> {s.rating.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.store_group && <Badge variant="outline">{s.store_group}</Badge>}
                    {s.price_range && <Badge variant="outline">{s.price_range}</Badge>}
                    <Badge variant="outline">{s.item_count} items</Badge>
                  </div>
                  {s.cuisine && <div className="text-xs text-muted-foreground line-clamp-1">{s.cuisine}</div>}
                  {s.address && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{s.address}</span>
                    </div>
                  )}
                  {s.telephone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> +{s.telephone}
                    </div>
                  )}
                  {s.uber_eats_url && (
                    <a
                      href={s.uber_eats_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Order on Uber Eats
                    </a>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
