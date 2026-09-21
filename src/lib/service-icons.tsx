import React from 'react';
import { FixGoColors } from '@/constants/theme';
import {
  AirVent,
  Zap,
  Droplets,
  WashingMachine,
  Refrigerator,
  Heater,
  Fan,
  BatteryCharging,
  Microwave,
  Wrench,
  LucideProps,
  LucideIcon
} from 'lucide-react-native';

export const getServiceIcon = (serviceName: string, props?: LucideProps) => {
  const defaultProps: LucideProps = {
    size: 24,
    color: FixGoColors.primary,
    strokeWidth: 2,
    ...props
  };

  const name = serviceName.toLowerCase();
  
  if (name.includes('ac') || name.includes('air')) return <AirVent {...defaultProps} />;
  if (name.includes('electr')) return <Zap {...defaultProps} />;
  if (name.includes('plumb')) return <Droplets {...defaultProps} />;
  if (name.includes('washing')) return <WashingMachine {...defaultProps} />;
  if (name.includes('fridge') || name.includes('refriger')) return <Refrigerator {...defaultProps} />;
  if (name.includes('ro') || name.includes('purifier') || name.includes('water')) return <Droplets {...defaultProps} />;
  if (name.includes('geyser') || name.includes('heater')) return <Heater {...defaultProps} />;
  if (name.includes('fan')) return <Fan {...defaultProps} />;
  if (name.includes('invert')) return <BatteryCharging {...defaultProps} />;
  if (name.includes('micro') || name.includes('oven')) return <Microwave {...defaultProps} />;
  
  return <Wrench {...defaultProps} />;
};
