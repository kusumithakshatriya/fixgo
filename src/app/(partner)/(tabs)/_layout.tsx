import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FixGoColors } from '@/constants/theme';

export default function PartnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: FixGoColors.primary,
        tabBarInactiveTintColor: FixGoColors.textSecondary,
        tabBarStyle: {
          backgroundColor: FixGoColors.card,
          borderTopColor: FixGoColors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="house.fill" size={24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="list.bullet.clipboard.fill" size={24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="gearshape.fill" size={24} tintColor={color} />
          ),
        }}
      />
    </Tabs>
  );
}
