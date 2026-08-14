import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/src/lib/theme";
import { useLang } from "@/src/lib/i18n";
import { useCart } from "@/src/lib/cart";
import { useAuth } from "@/src/lib/auth";
import { lockedRole, homeRouteFor } from "@/src/lib/roleRoute";

export default function TabsLayout() {
  const { t } = useLang();
  const { count } = useCart();
  const { user, ready } = useAuth();
  const router = useRouter();

  // Approved sellers, couriers, and admins/moderators live in their own panel.
  // If one of them ends up here (e.g. deep link, back navigation), bounce them
  // straight back so they can never wander into buyer mode.
  useEffect(() => {
    if (!ready) return;
    const role = lockedRole(user);
    if (role) router.replace(homeRouteFor(user) as any);
  }, [ready, user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brandDark,
        tabBarInactiveTintColor: C.borderStrong,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "home" : "home-outline"} size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: t("catalog"),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "grid" : "grid-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t("cart"),
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? "cart" : "cart-outline"} size={24} color={color} />
              {count > 0 && (
                <View style={{ position: "absolute", top: -4, right: -8, backgroundColor: C.error, borderRadius: 999, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{count}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("orders"),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
