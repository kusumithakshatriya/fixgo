import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, View } from 'react-native';

import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
};

export function Button({ label, loading = false, variant = 'primary', disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => {
        const { pressed } = state;
        return [
          styles.base,
          styles[variant],
          isDisabled && styles.disabled,
          pressed && !isDisabled && styles.pressed,
          typeof style === 'function' ? style(state) : style,
        ];
      }}
      {...props}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={variant === 'primary' ? FixGoColors.card : FixGoColors.primary} /> : null}
        <ThemedText style={[styles.label, variant !== 'primary' && styles.darkLabel]}>{label}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  primary: { backgroundColor: FixGoColors.primary },
  secondary: { backgroundColor: FixGoColors.accentSurface },
  outline: { backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.primary },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  label: { color: FixGoColors.card, fontSize: 16, fontWeight: '800' },
  darkLabel: { color: FixGoColors.primary },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
});
