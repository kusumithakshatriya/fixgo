import type { ServiceCategory } from '@/types/service';

export const serviceCategories: readonly ServiceCategory[] = [
  { id: 'ac-repair', name: 'AC Repair', icon: 'fan.fill', isMvp: true },
  { id: 'electrical', name: 'Electrical Work', icon: 'bolt.fill', isMvp: true },
  { id: 'plumbing', name: 'Plumbing', icon: 'drop.fill', isMvp: true },
  { id: 'washing-machine', name: 'Washing Machine Repair', icon: 'washer.fill', isMvp: false },
  { id: 'refrigerator', name: 'Refrigerator Repair', icon: 'snowflake', isMvp: false },
  { id: 'ro-water-purifier', name: 'RO / Water Purifier', icon: 'drop.degreesign', isMvp: false },
  { id: 'geyser', name: 'Geyser', icon: 'thermometer.medium', isMvp: false },
  { id: 'fan-repair', name: 'Fan Repair', icon: 'fan.fill', isMvp: false },
  { id: 'inverter-repair', name: 'Inverter Repair', icon: 'bolt.batteryblock.fill', isMvp: false },
  { id: 'microwave-repair', name: 'Microwave Repair', icon: 'microwave.fill', isMvp: false },
  { id: 'general-home-repair', name: 'General Home Repair', icon: 'wrench.and.screwdriver.fill', isMvp: false },
] as const;

export const mvpServiceCategories = serviceCategories.filter((service) => service.isMvp);
