import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { FixGoColors, Radius } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type CategoryCardProps = { 
  label: string; 
  icon: SymbolViewProps['name']; 
  isMVP?: boolean;
  onPress: () => void;
};

export function CategoryCard({ label, icon, isMVP, onPress }: CategoryCardProps) { 
  return (
    <Pressable 
      accessibilityRole="button" 
      accessibilityLabel={`Request ${label}`} 
      onPress={onPress} 
      style={({ pressed }) => [styles.card, pressed && styles.pressed, isMVP && styles.mvpCard]}
    >
      <View style={[styles.iconContainer, isMVP && styles.mvpIconContainer]}>
        <SymbolView name={icon} size={22} tintColor={isMVP ? FixGoColors.card : FixGoColors.primary} />
      </View>
      <ThemedText style={[styles.label, isMVP && styles.mvpLabel]} numberOfLines={2} adjustsFontSizeToFit>
        {label}
      </ThemedText>
    </Pressable>
  ); 
}

const styles = StyleSheet.create({ 
  card: { 
    width: '22%', 
    alignItems: 'center', 
    gap: 6,
    marginBottom: 12
  }, 
  mvpCard: {
    // MVP styles if needed
  },
  iconContainer: { 
    width: 60, 
    height: 60, 
    borderRadius: Radius.medium, 
    backgroundColor: FixGoColors.card, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: FixGoColors.border,
    shadowColor: FixGoColors.shadow, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 2 }, 
    elevation: 1 
  }, 
  mvpIconContainer: {
    backgroundColor: FixGoColors.primary,
    borderColor: FixGoColors.primary,
  },
  label: { 
    color: FixGoColors.textSecondary, 
    fontSize: 11, 
    lineHeight: 14, 
    fontWeight: '700',
    textAlign: 'center'
  }, 
  mvpLabel: {
    color: FixGoColors.text,
    fontWeight: '900'
  },
  pressed: { 
    opacity: 0.7 
  } 
});
