import type { SymbolViewProps } from 'expo-symbols';

export type ServiceId =
  | 'ac-repair' | 'electrical' | 'plumbing' | 'washing-machine' | 'refrigerator'
  | 'ro-water-purifier' | 'geyser' | 'fan-repair' | 'inverter-repair' | 'microwave-repair' | 'general-home-repair';

export type ServiceCategory = {
  id: ServiceId;
  name: string;
  icon: SymbolViewProps['name'];
  isMvp: boolean;
};
