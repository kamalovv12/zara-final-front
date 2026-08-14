import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage } from "@/src/utils/storage";
import { C, S, R } from "@/src/lib/theme";
import { useLang } from "@/src/lib/i18n";
import { api } from "@/src/lib/api";
import ProductCard from "@/src/components/ProductCard";

const SORTS = ["mix", "cheap", "expensive", "new", "rating"];

export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [sort, setSort] = useState("mix");
  const [discountOnly, setDiscountOnly] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<any>(null);

  const cols = Math.min(6, Math.max(2, Math.floor(width / 220)));
  const cardW = (Math.min(width, 1200) - S.lg * 2 - S.md * (cols - 1)) / cols;

  useEffect(() => {
    storage.getItem("search_history", "[]").then((v) => {
      try { setHistory(JSON.parse((v as string) || "[]")); } catch {}
    });
    api("/search/suggest?q=").then((r) => setSuggestions(r.suggestions)).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setSuggestions([]); return; }
    debounce.current = setTimeout(() => {
      api(`/search/suggest?q=${encodeURIComponent(q)}`).then((r) => setSuggestions(r.suggestions)).catch(() => {});
    }, 300);
  }, [q]);

  const doSearch = async (term?: string) => {
    const query = term ?? q;
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    if (term) setQ(term);
    const newHist = [query, ...history.filter((h) => h !== query)].slice(0, 8);
    setHistory(newHist);
    storage.setItem("search_history", JSON.stringify(newHist));
    let url = `/products?search=${encodeURIComponent(query)}&sort=${sort}&limit=40`;
    if (discountOnly) url += "&discount=true";
    if (inStock) url += "&in_stock=true";
    if (minP) url += `&min_price=${minP}`;
    if (maxP) url += `&max_price=${maxP}`;
    try {
      const r = await api(url);
      setResults(r.items);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (searched) doSearch();
  }, [sort, discountOnly, inStock]);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Pressable testID="search-back-button" onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.onSurface} />
        </Pressable>
        <View style={st.searchBox}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            testID="search-input"
            style={st.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder={t("search")}
            placeholderTextColor={C.muted}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => doSearch()}
          />
          {!!q && (
            <Pressable testID="search-clear-button" onPress={() => { setQ(""); setSearched(false); setResults([]); }}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {searched && (
        <>
          <View style={{ height: 56, justifyContent: "center" }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm, alignItems: "center" }}>
              {SORTS.map((s) => (
                <Pressable key={s} testID={`search-sort-${s}`} style={[st.chip, sort === s && st.chipActive]} onPress={() => setSort(s)}>
                  <Text style={[st.chipTxt, sort === s && { color: "#fff" }]}>{t(`sort_${s}`)}</Text>
                </Pressable>
              ))}
              <Pressable testID="search-filter-discount" style={[st.chip, discountOnly && st.chipActive]} onPress={() => setDiscountOnly(!discountOnly)}>
                <Text style={[st.chipTxt, discountOnly && { color: "#fff" }]}>{t("discount")} %</Text>
              </Pressable>
              <Pressable testID="search-filter-stock" style={[st.chip, inStock && st.chipActive]} onPress={() => setInStock(!inStock)}>
                <Text style={[st.chipTxt, inStock && { color: "#fff" }]}>Mavjud</Text>
              </Pressable>
            </ScrollView>
          </View>
          <View style={st.priceRow}>
            <TextInput testID="search-min-price" style={st.priceInput} value={minP} onChangeText={setMinP} placeholder="Narx dan" placeholderTextColor={C.muted} keyboardType="numeric" />
            <TextInput testID="search-max-price" style={st.priceInput} value={maxP} onChangeText={setMaxP} placeholder="Narx gacha" placeholderTextColor={C.muted} keyboardType="numeric" />
            <Pressable testID="search-apply-price" style={st.applyBtn} onPress={() => doSearch()}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{t("apply")}</Text>
            </Pressable>
          </View>
        </>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 60 }} />
      ) : searched ? (
        <FlatList
          key={cols}
          testID="search-results-list"
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={cols}
          columnWrapperStyle={{ paddingHorizontal: S.lg, maxWidth: 1200, alignSelf: "center", width: "100%" }}
          contentContainerStyle={{ paddingTop: S.md, paddingBottom: S.xl }}
          renderItem={({ item, index }) => (
            <View style={{ width: cardW, marginBottom: S.md, marginRight: (index + 1) % cols === 0 ? 0 : S.md }}>
              <ProductCard product={item} index={index % cols} />
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: C.muted, marginTop: 60 }}>Hech narsa topilmadi</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.lg, maxWidth: 800, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
          {suggestions.length > 0 && !!q && (
            <>
              {suggestions.map((s) => (
                <Pressable key={s} testID={`search-suggestion-${s}`} style={st.histRow} onPress={() => doSearch(s)}>
                  <Ionicons name="search" size={16} color={C.muted} />
                  <Text style={st.histTxt}>{s}</Text>
                </Pressable>
              ))}
            </>
          )}
          {history.length > 0 && !q && (
            <>
              <Text style={st.secTitle}>Qidiruv tarixi</Text>
              {history.map((h) => (
                <Pressable key={h} testID={`search-history-${h}`} style={st.histRow} onPress={() => doSearch(h)}>
                  <Ionicons name="time-outline" size={16} color={C.muted} />
                  <Text style={st.histTxt}>{h}</Text>
                </Pressable>
              ))}
            </>
          )}
          {suggestions.length > 0 && !q && (
            <>
              <Text style={st.secTitle}>Ommabop so'rovlar</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.sm }}>
                {suggestions.map((s) => (
                  <Pressable key={s} testID={`search-popular-${s}`} style={st.chip} onPress={() => doSearch(s)}>
                    <Text style={st.chipTxt}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, borderRadius: R.pill, alignItems: "center", justifyContent: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.tertiary, borderRadius: R.pill, paddingHorizontal: S.md, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: C.onSurface, height: "100%" },
  chip: { height: 36, paddingHorizontal: S.md, borderRadius: R.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: C.inverse, borderColor: C.inverse },
  chipTxt: { fontSize: 13, fontWeight: "600", color: C.onTertiary },
  priceRow: { flexDirection: "row", gap: S.sm, paddingHorizontal: S.lg, paddingBottom: S.sm },
  priceInput: { flex: 1, backgroundColor: C.card, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.md, height: 38, fontSize: 13, color: C.onSurface },
  applyBtn: { backgroundColor: C.brandDark, borderRadius: R.sm, paddingHorizontal: S.md, justifyContent: "center" },
  secTitle: { fontSize: 14, fontWeight: "900", color: C.onSurface, marginTop: S.lg, marginBottom: S.sm },
  histRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  histTxt: { fontSize: 14, color: C.onTertiary },
});
