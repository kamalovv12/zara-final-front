import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, S, R, fmt } from "@/src/lib/theme";
import { useLang, ml } from "@/src/lib/i18n";
import { useCart } from "@/src/lib/cart";

export default function ProductCard({ product, index = 0, width }: { product: any; index?: number; width?: number }) {
  const router = useRouter();
  const { lang, t } = useLang();
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [bigModal, setBigModal] = useState(false);
  const p = product;
  const salePrice = p.units_per_box
    ? (p.display_price ?? p.effective_box_price ?? ((p.piece_price ?? p.effective_price ?? 0) * p.units_per_box))
    : (p.display_price ?? p.effective_price);
  const oldPiecePrice = p.effective_old_price ?? p.old_price;
  const compareOldPrice = p.units_per_box
    ? (p.display_old_price ?? (oldPiecePrice != null ? oldPiecePrice * p.units_per_box : null))
    : (p.display_old_price ?? p.effective_old_price ?? p.old_price);
  const discount = compareOldPrice && compareOldPrice > salePrice ? Math.round((1 - salePrice / compareOldPrice) * 100) : p.flash_active ? Math.round((1 - salePrice / (compareOldPrice || salePrice || 1)) * 100) : 0;

  const quickAdd = (e: any) => {
    e?.stopPropagation?.();
    if (p.out_of_stock) return;
    if (product.onCardAddSkipModal) {
      add({ product_id: p.id, name: p.name, image: p.images?.[0], price: salePrice, stock: p.display_stock ?? p.stock, seller_id: p.seller_id, shop_name: p.seller?.shop_name, variation: null });
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } else {
      setBigModal(true);
    }
  };

  const confirmBig = () => {
    add({ product_id: p.id, name: p.name, image: p.images?.[0], price: salePrice, stock: p.display_stock ?? p.stock, seller_id: p.seller_id, shop_name: p.seller?.shop_name, variation: null });
    setBigModal(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 60, 400)).springify()} style={[styles.card, width ? { width } : { flex: 1 }]}>
      <Pressable testID={`product-card-${p.id}`} onPress={() => router.push(`/product/${p.id}`)}>
        <View style={styles.imgWrap}>
          <Image source={{ uri: p.images?.[0] }} style={styles.img} contentFit="cover" transition={200} />
          {discount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>-{discount}%</Text>
            </View>
          )}
          {p.pinned && (
            <View style={styles.pinBadge}>
              <Ionicons name="star" size={10} color={C.onBrandSoft} />
              <Text style={styles.pinTxt}>TOP</Text>
            </View>
          )}
          {p.out_of_stock && (
            <View style={styles.outOverlay}>
              <Text style={styles.outTxt}>{t("outOfStock")}</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {ml(p.name, lang)}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={C.warning} />
            <Text style={styles.rating}>
              {p.rating || "—"} ({p.reviews_count || 0})
            </Text>
          </View>
          <Text style={styles.price}>{fmt(salePrice)}</Text>
          {(compareOldPrice || p.flash_active) && <Text style={styles.oldPrice}>{fmt(compareOldPrice || salePrice)}</Text>}
          {!!p.units_per_box && <Text style={styles.metaSmall}>1 quti = {p.units_per_box} ta</Text>}
        </View>
      </Pressable>
      <Pressable testID={`product-card-addtocart-${p.id}`} style={[styles.cartBtn, p.out_of_stock && { opacity: 0.5 }]} onPress={quickAdd} disabled={p.out_of_stock}>
        <Ionicons name={added ? "checkmark" : "cart-outline"} size={14} color={C.brandDark} />
        <Text style={styles.cartBtnTxt}>{added ? "✓ Savatda" : "Savatga qo'shish"}</Text>
      </Pressable>

      <Modal visible={bigModal} transparent animationType="fade" onRequestClose={() => setBigModal(false)}>
        <Pressable testID="addtocart-backdrop" style={styles.backdrop} onPress={() => setBigModal(false)}>
          <Pressable style={styles.bigCard} onPress={(e) => e.stopPropagation()}>
            <Image source={{ uri: p.images?.[0] }} style={styles.bigImg} contentFit="cover" />
            <Text style={styles.bigTitle} numberOfLines={2}>{ml(p.name, lang)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="star" size={14} color={C.warning} />
              <Text style={styles.bigRating}>{p.rating || "—"} ({p.reviews_count || 0})</Text>
            </View>
            <Text style={styles.bigPrice}>{fmt(salePrice)}</Text>
            {compareOldPrice && compareOldPrice > salePrice && (<Text style={styles.bigOld}>{fmt(compareOldPrice)}</Text>)}
            {!!p.units_per_box && <Text style={styles.metaSmall}>1 quti = {p.units_per_box} ta</Text>}
            <Pressable testID="addtocart-confirm-big" style={styles.bigAddBtn} onPress={confirmBig}>
              <Ionicons name="cart" size={18} color="#fff" />
              <Text style={styles.bigAddTxt}>Savatga qo'shish</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.md, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  imgWrap: { aspectRatio: 1, backgroundColor: C.tertiary },
  img: { width: "100%", height: "100%" },
  badge: { position: "absolute", top: 8, left: 8, backgroundColor: C.error, borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pinBadge: { position: "absolute", top: 8, right: 8, backgroundColor: C.brandSoft, borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 3 },
  pinTxt: { color: C.onBrandSoft, fontSize: 10, fontWeight: "800" },
  outOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(249,250,251,0.65)", alignItems: "center", justifyContent: "center" },
  outTxt: { backgroundColor: C.inverse, color: "#fff", fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  info: { padding: S.sm + 2 },
  name: { fontSize: 13, color: C.onCard, fontWeight: "600", minHeight: 34 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  rating: { fontSize: 11, color: C.muted },
  price: { fontSize: 15, fontWeight: "800", color: C.onSurface, marginTop: 4 },
  oldPrice: { fontSize: 12, color: C.muted, textDecorationLine: "line-through" },
  metaSmall: { fontSize: 11, color: C.muted, marginTop: 4 },
  cartBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.brandSoft, margin: S.sm, marginTop: 0, paddingVertical: 8, borderRadius: R.sm },
  cartBtnTxt: { color: C.brandDark, fontWeight: "800", fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: S.lg },
  bigCard: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderColor: C.border },
  bigImg: { width: 160, height: 160, borderRadius: R.md, marginBottom: S.sm },
  bigTitle: { fontSize: 16, fontWeight: "900", color: C.onSurface, textAlign: "center", marginBottom: 4 },
  bigRating: { fontSize: 12, color: C.muted, fontWeight: "700" },
  bigPrice: { fontSize: 22, fontWeight: "900", color: C.brandDark, marginTop: 6 },
  bigOld: { fontSize: 13, color: C.muted, textDecorationLine: "line-through", marginTop: 2 },
  bigAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.brandDark, borderRadius: R.md, paddingVertical: 14, paddingHorizontal: S.xl, marginTop: S.md, alignSelf: "stretch" },
  bigAddTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
