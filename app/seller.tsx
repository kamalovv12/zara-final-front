import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C, S, R, fmt } from "@/src/lib/theme";
import { useLang, ml } from "@/src/lib/i18n";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { getCurrentLocation } from "@/src/lib/geo";

const TABS = [
  { k: "stats", l: "Statistika", icon: "stats-chart" },
  { k: "products", l: "Mahsulotlar", icon: "cube" },
  { k: "orders", l: "Buyurtmalar", icon: "receipt" },
];

const STATUS_LABEL: Record<string, string> = { new: "Yangi", confirmed: "Tasdiqlandi", packing: "Yig'ilmoqda", courier: "Kuryerda", delivered: "Yetkazildi", cancelled: "Bekor", seller_rejected: "Sotuvchi rad etdi" };
const MAX_IMAGES = 5;

export default function Seller() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lang, t } = useLang();
  const { user, logout, refresh } = useAuth();
  const [tab, setTab] = useState("stats");
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ name_uz: "", name_ru: "", name_en: "", price: "", old_price: "", cost_price: "", box_price: "", units_per_box: "", stock: "", category_id: "", desc_uz: "", images: [] as string[] });
  const [msg, setMsg] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shopLocLoading, setShopLocLoading] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState<string | null>("stats");

  const getShopLocation = async () => {
    setMsg("");
    setShopLocLoading(true);
    try {
      const loc = await getCurrentLocation();
      await api("/seller/location", { method: "PUT", body: loc });
      await refresh();
      setMsg("Do'kon lokatsiyasi saqlandi ✓");
    } catch (e: any) {
      setMsg(e.message);
    }
    setShopLocLoading(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel but each result applied as soon as it arrives — UI not blocked by slowest
      const pStats = api("/seller/stats").then((st) => { if (st) setStats(st); }).catch(() => {});
      const pProds = api("/seller/products").then((pr) => { setProducts(Array.isArray(pr) ? pr : []); }).catch(() => setProducts([]));
      const pOrds = api("/seller/orders").then((ord) => { setOrders(Array.isArray(ord) ? ord : []); }).catch(() => setOrders([]));
      const pCats = api("/categories").then((ct) => { setCats(Array.isArray(ct) ? ct : []); }).catch(() => {});
      await Promise.all([pStats, pProds, pOrds, pCats]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rootCats = useMemo(() => {
    const seen = new Set<string>();
    return cats.filter((c) => !c.parent_id).filter((c) => {
      const key = `${(c?.name?.uz || "").trim().toLowerCase()}::${(c?.name?.ru || "").trim().toLowerCase()}::${(c?.name?.en || "").trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cats]);

  const isCompactForm = width < 520;
  const unitsPerBox = parseInt(form.units_per_box) || 0;
  const piecePrice = parseFloat(form.price) || 0;
  const boxPricePreview = form.box_price ? parseFloat(form.box_price) || 0 : unitsPerBox > 0 ? piecePrice * unitsPerBox : 0;
  const fullBoxesInStock = unitsPerBox > 0 ? Math.floor((parseInt(form.stock) || 0) / unitsPerBox) : 0;

  const pickImage = async () => {
    if (form.images.length >= MAX_IMAGES) {
      setMsg(`Ko'pi bilan ${MAX_IMAGES} ta rasm yuklash mumkin`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMsg("Rasm yuklash uchun galereyaga ruxsat bering");
      return;
    }
    setUploading(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - form.images.length,
      });
      if (!res.canceled) {
        const uris = res.assets
          .filter((a) => !!a.base64)
          .map((a) => `data:image/jpeg;base64,${a.base64}`);
        setForm((f: any) => ({ ...f, images: [...f.images, ...uris].slice(0, MAX_IMAGES) }));
      }
    } catch (e: any) {
      setMsg("Rasm yuklashda xatolik");
    }
    setUploading(false);
  };

  const removeImage = (idx: number) => {
    setForm((f: any) => ({ ...f, images: f.images.filter((_: any, i: number) => i !== idx) }));
  };

  const saveProduct = async () => {
    if (savingProduct) return;
    setMsg("");
    const hasPiecePrice = !!String(form.price || "").trim();
    const hasBoxPrice = !!String(form.box_price || "").trim();
    const parsedUnits = parseInt(form.units_per_box) || 0;
    if (!form.name_uz.trim()) {
      setMsg("Mahsulot nomini kiriting");
      return;
    }
    if (!hasPiecePrice && !hasBoxPrice) {
      setMsg("Donasi narxi yoki quti narxidan kamida bittasini kiriting");
      return;
    }
    if (!hasPiecePrice && hasBoxPrice && parsedUnits <= 0) {
      setMsg("Faqat quti narxi kiritilsa, 1 qutida nechta ham ko'rsatilishi kerak");
      return;
    }
    if (!editId && form.images.length === 0) {
      setMsg("Kamida bitta mahsulot rasmini yuklang");
      return;
    }
    setSavingProduct(true);
    try {
      const parsedUnits = parseInt(form.units_per_box) || 0;
      const parsedBoxPrice = form.box_price ? parseFloat(form.box_price) : null;
      const derivedPiecePrice = form.price
        ? parseFloat(form.price) || 0
        : (parsedBoxPrice != null && parsedUnits > 0 ? parsedBoxPrice / parsedUnits : 0);
      const body = {
        name_uz: form.name_uz, name_ru: form.name_ru, name_en: form.name_en, desc_uz: form.desc_uz,
        category_id: form.category_id || cats.find((c) => !c.parent_id)?.id,
        price: derivedPiecePrice, old_price: form.old_price ? parseFloat(form.old_price) : null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
        box_price: parsedBoxPrice,
        units_per_box: parsedUnits,
        stock: parseInt(form.stock) || 0, images: form.images,
      };
      if (editId) await api(`/seller/products/${editId}/update`, { method: "POST", body });
      else await api("/seller/products", { method: "POST", body });
      setShowForm(false);
      setEditId(null);
      setForm({ name_uz: "", name_ru: "", name_en: "", price: "", old_price: "", cost_price: "", box_price: "", units_per_box: "", stock: "", category_id: "", desc_uz: "", images: [] });
      setMsg("Mahsulot moderatsiyaga yuborildi ✓");
      load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSavingProduct(false);
    }
  };

  const orderAction = async (oid: string, action: string) => {
    const key = `${oid}:${action}`;
    if (orderBusy === key) return;
    setOrderBusy(key);
    await api(`/seller/orders/${oid}/action`, { method: "POST", body: { action, reason: action === "reject" ? "Sotuvchi rad etdi" : "" } }).catch(() => {});
    setOrderBusy(null);
    load();
  };

  const startEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name_uz: p.name.uz, name_ru: p.name.ru, name_en: p.name.en, price: p.price ? String(p.price) : "", old_price: p.old_price ? String(p.old_price) : "", cost_price: p.cost_price ? String(p.cost_price) : "", box_price: p.seller_box_price ? String(p.seller_box_price) : p.box_price ? String(p.box_price) : "", units_per_box: p.units_per_box ? String(p.units_per_box) : "", stock: String(p.stock), category_id: p.category_id, desc_uz: p.desc.uz, images: p.images || [] });
    setShowForm(true);
    setMsg("");
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={[C.inverse, "#064E3B"]} style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>{t("sellerPanel")}</Text>
          <Text style={st.headerSub}>{user?.seller_info?.shop_name || "Do'kon"}</Text>
        </View>
        {/* Sellers are locked into this panel — no way back to buyer mode, only sign out. */}
        <Pressable testID="seller-logout-button" onPress={() => setConfirmLogout(true)} style={st.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
        </Pressable>
      </LinearGradient>

      {confirmLogout && (
        <View style={st.confirmBar}>
          <Text style={st.confirmTxt}>Hisobdan chiqmoqchimisiz?</Text>
          <View style={{ flexDirection: "row", gap: S.sm }}>
            <Pressable testID="seller-logout-confirm" style={[st.miniBtn, { backgroundColor: C.error }]} onPress={logout}>
              <Text style={st.miniBtnTxt}>Ha, chiqish</Text>
            </Pressable>
            <Pressable testID="seller-logout-cancel" style={[st.miniBtn, { backgroundColor: C.tertiary }]} onPress={() => setConfirmLogout(false)}>
              <Text style={[st.miniBtnTxt, { color: C.onSurface }]}>Bekor qilish</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={st.tabRow}>
        {TABS.map((tb) => (
          <Pressable key={tb.k} testID={`seller-tab-${tb.k}`} style={[st.tab, tab === tb.k && st.tabActive]} onPress={() => setTab(tb.k)}>
            <Ionicons name={tb.icon as any} size={16} color={tab === tb.k ? C.brandDark : C.muted} />
            <Text style={[st.tabTxt, tab === tb.k && { color: C.brandDark }]}>{tb.l}</Text>
          </Pressable>
        ))}
      </View>
      {!!msg && <Text style={st.msg}>{msg}</Text>}

      <ScrollView contentContainerStyle={{ padding: S.lg, maxWidth: 900, width: "100%", alignSelf: "center", paddingBottom: S.xxl }}>
        {tab === "stats" && (
          <View style={st.locCard}>
            <View style={st.locIconBox}>
              <Ionicons name="location" size={20} color={C.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.locTitle}>Do'kon lokatsiyasi</Text>
              <Text testID="seller-shop-location-status" style={st.locSub}>
                {user?.seller_info?.shop_lat != null
                  ? `📍 ${Number(user.seller_info.shop_lat).toFixed(6)}, ${Number(user.seller_info.shop_lng).toFixed(6)}`
                  : "Kiritilmagan — kuryer marshruti uchun zarur"}
              </Text>
            </View>
            <Pressable testID="seller-get-location-button" style={[st.locBtn, shopLocLoading && { opacity: 0.6 }]} onPress={getShopLocation} disabled={shopLocLoading}>
              {shopLocLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="locate" size={14} color="#fff" />}
              <Text style={st.locBtnTxt}>Joriy lokatsiyamni olish</Text>
            </Pressable>
          </View>
        )}

        {tab === "stats" && !stats && loading && (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={C.brandDark} />
            <Text style={{ marginTop: 12, color: C.muted }}>Statistika yuklanmoqda...</Text>
          </View>
        )}
        {tab === "stats" && stats && (
          <>
            <View style={st.statGrid}>
              {[
                { l: "Bugungi buyurtmalar", v: String(stats.today_orders || 0), icon: "receipt" },
                { l: "Bugungi summa", v: fmt(stats.today_sales || 0), icon: "cash" },
                { l: "Qaytarilgan buyurtmalar", v: String(stats.today_returns_count || 0), icon: "return-up-back" },
                { l: "Qaytarilgan summa", v: fmt(stats.today_returns_amount || 0), icon: "refresh-circle" },
              ].map((s, i) => (
                <Animated.View key={s.l} entering={FadeInDown.delay(i * 60).springify()} style={st.statCard}>
                  <View style={st.statIconBox}>
                    <Ionicons name={s.icon as any} size={18} color={C.brandDark} />
                  </View>
                  <Text style={st.statVal}>{s.v}</Text>
                  <Text style={st.statLabel}>{s.l}</Text>
                </Animated.View>
              ))}
            </View>
            <View style={st.infoNote}>
              <Ionicons name="information-circle" size={16} color={C.onBrandSoft} />
              <Text style={st.infoNoteTxt}>Bu yerda faqat bugungi ish ko'rsatkichlari ko'rsatiladi. Admin statistikani 0 qilsa, hisob shu nuqtadan qayta boshlanadi.</Text>
            </View>
            <Text style={st.secTitle}>Eng ko'p sotilgan</Text>
            {stats.top_products.map((p: any, i: number) => (
              <View key={i} style={st.topRow}>
                <Text style={st.topRank}>#{i + 1}</Text>
                <Text style={st.topName} numberOfLines={1}>{p.name}</Text>
                <Text style={st.topMeta}>{p.sold} sotildi • {p.views} ko'rish</Text>
              </View>
            ))}
          </>
        )}

        {tab === "products" && (
          <>
            <Pressable testID="seller-add-product-button" style={st.addBtn} onPress={() => { setShowForm(!showForm); setEditId(null); setForm({ name_uz: "", name_ru: "", name_en: "", price: "", old_price: "", cost_price: "", box_price: "", units_per_box: "", stock: "", category_id: "", desc_uz: "", images: [] }); setMsg(""); }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800" }}>Mahsulot qo'shish</Text>
            </Pressable>
            {showForm && (
              <View style={st.form}>
                <Text style={st.formLabel}>{t("addImages")} *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }}>
                  {form.images.map((uri: string, idx: number) => (
                    <View key={idx} style={st.imgThumbWrap}>
                      <Image source={{ uri }} style={st.imgThumb} contentFit="cover" />
                      <Pressable testID={`seller-form-remove-image-${idx}`} style={st.imgRemoveBtn} onPress={() => removeImage(idx)}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {form.images.length < MAX_IMAGES && (
                    <Pressable testID="seller-form-pick-image" style={st.imgAddBtn} onPress={pickImage} disabled={uploading}>
                      <Ionicons name={uploading ? "hourglass-outline" : "camera-outline"} size={22} color={C.brandDark} />
                      <Text style={st.imgAddTxt}>{t("addImage")}</Text>
                    </Pressable>
                  )}
                </ScrollView>
                <TextInput testID="seller-form-name-uz" style={st.input} value={form.name_uz} onChangeText={(v) => setForm({ ...form, name_uz: v })} placeholder="Nomi (O'zbekcha) *" placeholderTextColor={C.muted} />
                <TextInput testID="seller-form-name-ru" style={st.input} value={form.name_ru} onChangeText={(v) => setForm({ ...form, name_ru: v })} placeholder="Nomi (Ruscha)" placeholderTextColor={C.muted} />
                <TextInput testID="seller-form-name-en" style={st.input} value={form.name_en} onChangeText={(v) => setForm({ ...form, name_en: v })} placeholder="Nomi (Inglizcha)" placeholderTextColor={C.muted} />
                <TextInput testID="seller-form-desc" style={st.input} value={form.desc_uz} onChangeText={(v) => setForm({ ...form, desc_uz: v })} placeholder="Tavsif" placeholderTextColor={C.muted} multiline />
                <View style={[st.formRow, isCompactForm && st.formRowStack]}>
                  <TextInput testID="seller-form-price" style={[st.input, st.formInput, isCompactForm && st.formInputFull]} value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} placeholder="Donasi narxi (ixtiyoriy)" placeholderTextColor={C.muted} keyboardType="numeric" />
                  <TextInput testID="seller-form-old-price" style={[st.input, st.formInput, isCompactForm && st.formInputFull]} value={form.old_price} onChangeText={(v) => setForm({ ...form, old_price: v })} placeholder="Eski narx" placeholderTextColor={C.muted} keyboardType="numeric" />
                  <TextInput testID="seller-form-stock" style={[st.input, st.formInput, isCompactForm && st.formInputFull]} value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v })} placeholder="Qoldiq (dona)" placeholderTextColor={C.muted} keyboardType="numeric" />
                </View>
                <View style={[st.formRow, isCompactForm && st.formRowStack]}>
                  <TextInput testID="seller-form-units-per-box" style={[st.input, st.formInput, isCompactForm && st.formInputFull]} value={form.units_per_box} onChangeText={(v) => setForm({ ...form, units_per_box: v })} placeholder="1 qutida nechta" placeholderTextColor={C.muted} keyboardType="numeric" />
                  <TextInput testID="seller-form-box-price" style={[st.input, st.formInput, isCompactForm && st.formInputFull]} value={form.box_price} onChangeText={(v) => setForm({ ...form, box_price: v })} placeholder="Quti narxi" placeholderTextColor={C.muted} keyboardType="numeric" />
                </View>
                {unitsPerBox > 0 && (
                  <View style={st.infoNote}>
                    <Ionicons name="cube-outline" size={16} color={C.onBrandSoft} />
                    <Text style={st.infoNoteTxt}>1 quti = {unitsPerBox} ta • donasi: {fmt(piecePrice)} • quti narxi: {fmt(boxPricePreview)}{fullBoxesInStock > 0 ? ` • to'liq quti: ${fullBoxesInStock} ta` : ""}</Text>
                  </View>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingVertical: S.sm }}>
                  {rootCats.map((c) => (
                    <Pressable key={c.id} testID={`seller-form-cat-${c.id}`} style={[st.chip, form.category_id === c.id && st.chipActive]} onPress={() => setForm({ ...form, category_id: c.id })}>
                      <Text style={[st.chipTxt, form.category_id === c.id && { color: "#fff" }]}>{ml(c.name, lang)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable testID="seller-form-save-button" style={[st.saveBtn, savingProduct && { opacity: 0.7 }]} onPress={saveProduct} disabled={savingProduct}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>{savingProduct ? "Yuklanmoqda..." : editId ? "Saqlash" : "Moderatsiyaga yuborish"}</Text>
                </Pressable>
              </View>
            )}
            {loading && products.length === 0 && (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={C.brandDark} />
                <Text style={{ marginTop: 12, color: C.muted }}>Mahsulotlar yuklanmoqda...</Text>
              </View>
            )}
            {!loading && products.length === 0 && (
              <Text style={st.empty}>Mahsulot yo'q. Yuqoridan qo'shing.</Text>
            )}
            {products.map((p) => {
              const expanded = expandedProductId === p.id;
              const boxPrice = p.seller_box_price ?? ((p.seller_price ?? p.price) * (p.units_per_box || 0));
              return (
                <View key={p.id} style={st.prodRow}>
                  <Pressable style={st.prodTopRow} onPress={() => setExpandedProductId(expanded ? null : p.id)}>
                    <Image source={{ uri: p.images?.[0] }} style={st.prodImg} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={st.prodName} numberOfLines={1}>{ml(p.name, lang)}</Text>
                      <Text style={st.prodMeta}>
                        {!!p.units_per_box
                          ? `${fmt(boxPrice)} • Qoldiq: ${p.stock} dona`
                          : `${fmt(p.seller_price ?? p.price)} • Qoldiq: ${p.stock} dona`}
                      </Text>
                      {!!p.units_per_box && <Text style={st.prodMeta}>1 quti = {p.units_per_box} ta • donasi: {fmt(p.seller_price ?? p.price)}</Text>}
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <View style={[st.badge, p.status === "approved" ? { backgroundColor: C.brandSoft } : p.status === "pending" ? { backgroundColor: "#FEF3C7" } : { backgroundColor: "#FEE2E2" }]}>
                          <Text style={[st.badgeTxt, { color: p.status === "approved" ? C.onBrandSoft : p.status === "pending" ? "#B45309" : C.error }]}>
                            {p.status === "approved" ? "Tasdiqlangan" : p.status === "pending" ? "Moderatsiyada" : "Rad etilgan"}
                          </Text>
                        </View>
                        {p.stock <= 0 && <View style={[st.badge, { backgroundColor: C.tertiary }]}><Text style={[st.badgeTxt, { color: C.muted }]}>Tugagan</Text></View>}
                        {p.hidden && <View style={[st.badge, { backgroundColor: C.tertiary }]}><Text style={[st.badgeTxt, { color: C.muted }]}>Yashirilgan</Text></View>}
                      </View>
                    </View>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={C.muted} />
                  </Pressable>
                  {expanded && (
                    <View style={st.prodActionsPanel}>
                      <Pressable testID={`seller-edit-${p.id}`} style={st.prodActionBtn} onPress={() => startEdit(p)}>
                        <Ionicons name="create-outline" size={16} color={C.onSurface} />
                        <Text style={st.prodActionTxt}>Edit</Text>
                      </Pressable>
                      <Pressable testID={`seller-hide-${p.id}`} style={st.prodActionBtn} onPress={async () => { await api(`/seller/products/${p.id}/toggle-hide`, { method: "POST" }); load(); }}>
                        <Ionicons name={p.hidden ? "eye" : "eye-off"} size={16} color={C.onSurface} />
                        <Text style={st.prodActionTxt}>{p.hidden ? "Show" : "Hide"}</Text>
                      </Pressable>
                      <Pressable testID={`seller-delete-${p.id}`} style={[st.prodActionBtn, st.prodActionBtnDanger]} onPress={() => Alert.alert("Tasdiqlash", "rostan ham uchirmoqchimisiz", [{ text: "Yo'q", style: "cancel" }, { text: "Ha", style: "destructive", onPress: async () => { await api(`/seller/products/${p.id}/delete`, { method: "POST" }); load(); } }])}>
                        <Ionicons name="trash-outline" size={16} color={C.error} />
                        <Text style={[st.prodActionTxt, { color: C.error }]}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {tab === "orders" && (
          <>
            <View style={st.infoNote}>
              <Ionicons name="shield-checkmark" size={16} color={C.onBrandSoft} />
              <Text style={st.infoNoteTxt}>Maxfiylik uchun xaridor ma'lumotlari (ismi, telefoni, manzili) sizga ko'rsatilmaydi — faqat buyurtma raqami orqali ishlaysiz.</Text>
            </View>
            {loading && orders.length === 0 && (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={C.brandDark} />
                <Text style={{ marginTop: 12, color: C.muted }}>Buyurtmalar yuklanmoqda...</Text>
              </View>
            )}
            {!loading && orders.length === 0 && <Text style={st.empty}>Hozircha buyurtma yo'q</Text>}
            {orders.map((o) => (
              <View key={o.id} style={st.orderCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "900", color: C.onSurface, fontSize: 15 }}>{o.number}</Text>
                  <View style={[st.badge, { backgroundColor: C.tertiary }]}>
                    <Text style={[st.badgeTxt, { color: C.onTertiary }]}>{STATUS_LABEL[o.status]}</Text>
                  </View>
                </View>
                <Text style={st.orderMeta}>{o.delivery_method === "pickup" ? "🏪 Xaridor o'zi olib ketadi" : "🛵 Kuryer orqali yetkaziladi"}</Text>
                {o.items.map((i: any, idx: number) => (
                  <View key={idx} style={st.orderItemRow}>
                    <Text style={st.orderItem}>• {ml(i.name, lang)}{i.variation ? ` (${i.variation})` : ""} × {i.qty} = {fmt(i.price * i.qty)}</Text>
                    {i.delivery_status === "returned" && (
                      <View style={st.returnBadgeMini}>
                        <Text style={st.returnBadgeMiniTxt}>Qaytgan</Text>
                      </View>
                    )}
                  </View>
                ))}
                {!!o.returned_items_count && <Text style={st.returnSummary}>Qaytgan mahsulotlar: {o.returned_items_count} ta</Text>}
                <Text style={{ fontWeight: "900", color: C.brandDark, marginTop: 4 }}>Daromadingiz: {fmt(o.earn_total)}</Text>
                {o.status === "seller_rejected" && <Text style={st.returnSummary}>Buyurtma admin ko'rib chiqishiga yuborildi</Text>}
                <View style={{ flexDirection: "row", gap: S.sm, marginTop: S.sm }}>
                  {o.status === "new" && (
                    <>
                      <Pressable testID={`seller-accept-${o.id}`} style={[st.actBtn, { backgroundColor: C.brandDark }, orderBusy === `${o.id}:accept` && { opacity: 0.7 }]} onPress={() => orderAction(o.id, "accept")} disabled={orderBusy === `${o.id}:accept`}>
                        <Text style={st.actTxt}>{orderBusy === `${o.id}:accept` ? "Yuklanmoqda..." : "Qabul qilish"}</Text>
                      </Pressable>
                      <Pressable testID={`seller-reject-${o.id}`} style={[st.actBtn, { backgroundColor: C.error }, orderBusy === `${o.id}:reject` && { opacity: 0.7 }]} onPress={() => orderAction(o.id, "reject")} disabled={orderBusy === `${o.id}:reject`}>
                        <Text style={st.actTxt}>{orderBusy === `${o.id}:reject` ? "Yuklanmoqda..." : "Rad etish"}</Text>
                      </Pressable>
                    </>
                  )}
                  {o.status === "confirmed" && (
                    <Pressable testID={`seller-packed-${o.id}`} style={[st.actBtn, { backgroundColor: C.inverse }, orderBusy === `${o.id}:packed` && { opacity: 0.7 }]} onPress={() => orderAction(o.id, "packed")} disabled={orderBusy === `${o.id}:packed`}>
                      <Text style={st.actTxt}>{orderBusy === `${o.id}:packed` ? "Yuklanmoqda..." : "Yig'ildi ✓"}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.lg, paddingVertical: S.md },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2, fontWeight: "600" },
  logoutBtn: { width: 40, height: 40, borderRadius: R.pill, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  confirmBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FEF2F2", padding: S.md, borderBottomWidth: 1, borderBottomColor: "#FECACA" },
  confirmTxt: { color: C.onSurface, fontWeight: "700", fontSize: 13, flex: 1 },
  miniBtn: { borderRadius: R.sm, paddingHorizontal: S.md, height: 34, alignItems: "center", justifyContent: "center" },
  miniBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  tabRow: { flexDirection: "row", backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: S.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.brandDark },
  tabTxt: { fontWeight: "700", fontSize: 13, color: C.muted },
  msg: { color: C.brandDark, fontWeight: "700", fontSize: 13, textAlign: "center", marginTop: S.sm },
  infoNote: { flexDirection: "row", gap: 8, backgroundColor: C.brandSoft, borderRadius: R.md, padding: S.md, marginTop: S.md, alignItems: "flex-start" },
  infoNoteTxt: { color: C.onBrandSoft, fontSize: 12, flex: 1, lineHeight: 17 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: S.md },
  statCard: { flexBasis: "30%", flexGrow: 1, backgroundColor: C.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.border, gap: 4, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  statIconBox: { width: 30, height: 30, borderRadius: R.sm, backgroundColor: C.brandTint, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  statLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },
  secTitle: { fontSize: 16, fontWeight: "900", color: C.onSurface, marginTop: S.xl, marginBottom: S.md },
  topRow: { flexDirection: "row", alignItems: "center", gap: S.md, backgroundColor: C.card, borderRadius: R.sm, padding: S.md, marginBottom: S.sm, borderWidth: 1, borderColor: C.border },
  topRank: { fontWeight: "900", color: C.brandDark, fontSize: 14 },
  topName: { flex: 1, fontWeight: "700", fontSize: 13, color: C.onSurface },
  topMeta: { fontSize: 11, color: C.muted },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.brandDark, borderRadius: R.md, height: 48, marginBottom: S.md },
  form: { backgroundColor: C.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.border, marginBottom: S.md, gap: S.sm },
  formLabel: { fontSize: 12, fontWeight: "800", color: C.onTertiary, textTransform: "uppercase", letterSpacing: 0.4 },
  imgThumbWrap: { width: 64, height: 64, borderRadius: R.sm, overflow: "visible" },
  imgThumb: { width: 64, height: 64, borderRadius: R.sm, backgroundColor: C.tertiary },
  imgRemoveBtn: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.card },
  imgAddBtn: { width: 64, height: 64, borderRadius: R.sm, backgroundColor: C.brandTint, borderWidth: 1.5, borderColor: C.brand, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 2 },
  imgAddTxt: { fontSize: 8, color: C.brandDark, fontWeight: "800" },
  input: { backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, padding: S.md, color: C.onSurface, fontSize: 13, minWidth: 0 },
  formRow: { flexDirection: "row", gap: S.sm },
  formRowStack: { flexDirection: "column" },
  formInput: { flex: 1, minWidth: 0 },
  formInputFull: { width: "100%", flexBasis: "100%" },
  chip: { height: 34, paddingHorizontal: S.md, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: C.brandDark, borderColor: C.brandDark },
  chipTxt: { fontSize: 12, fontWeight: "600", color: C.onTertiary },
  saveBtn: { backgroundColor: C.inverse, borderRadius: R.sm, height: 46, alignItems: "center", justifyContent: "center" },
  prodRow: { backgroundColor: C.card, borderRadius: R.lg, padding: S.md, marginBottom: S.sm, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  prodTopRow: { flexDirection: "row", gap: S.md, alignItems: "center" },
  prodImg: { width: 64, height: 64, borderRadius: R.md, backgroundColor: C.tertiary },
  prodName: { fontWeight: "700", fontSize: 14, color: C.onSurface },
  prodMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  badge: { borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  iconBtn: { width: 32, height: 32, borderRadius: R.sm, backgroundColor: C.tertiary, alignItems: "center", justifyContent: "center" },
  prodActionsPanel: { flexDirection: "row", gap: S.sm, marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.border, flexWrap: "wrap" },
  prodActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 96, height: 38, borderRadius: R.sm, paddingHorizontal: S.md, backgroundColor: C.tertiary },
  prodActionBtnDanger: { backgroundColor: "#FEF2F2" },
  prodActionTxt: { fontSize: 12, fontWeight: "800", color: C.onSurface },
  empty: { color: C.muted, fontSize: 13, marginTop: S.md, textAlign: "center" },
  orderCard: { backgroundColor: C.card, borderRadius: R.lg, padding: S.md, marginBottom: S.md, borderWidth: 1, borderColor: C.border },
  orderMeta: { fontSize: 12, color: C.onTertiary, marginTop: 4 },
  orderItemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginTop: 3 },
  orderItem: { fontSize: 12, color: C.muted, flex: 1 },
  returnBadgeMini: { borderRadius: R.pill, backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3 },
  returnBadgeMiniTxt: { color: C.error, fontSize: 10, fontWeight: "800" },
  returnSummary: { fontSize: 12, color: C.error, fontWeight: "800", marginTop: 6 },
  actBtn: { flex: 1, borderRadius: R.sm, height: 40, alignItems: "center", justifyContent: "center" },
  actTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  locCard: { flexDirection: "row", alignItems: "center", gap: S.md, backgroundColor: C.card, borderRadius: R.lg, padding: S.md, borderWidth: 1.5, borderColor: C.brand, marginBottom: S.md, flexWrap: "wrap" },
  locIconBox: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.brandTint, alignItems: "center", justifyContent: "center" },
  locTitle: { fontWeight: "900", fontSize: 14, color: C.onSurface },
  locSub: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: "600" },
  locBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.brandDark, borderRadius: R.md, paddingHorizontal: S.md, height: 40 },
  locBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
