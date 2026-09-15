import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type InputProps = TextInputProps & {
  error?: string;
  label?: string;
};

export function Input({ error, label, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={FixGoColors.textSecondary}
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        {...props}
      />
      {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  label: { color: FixGoColors.text, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 52, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, backgroundColor: FixGoColors.card, color: FixGoColors.text, fontSize: 16, paddingHorizontal: Spacing.three },
  inputError: { borderColor: '#C93D3D' },
  error: { color: '#C93D3D', fontSize: 13, fontWeight: '600' },
});
