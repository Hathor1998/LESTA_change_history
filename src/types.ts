export type ChangeCategory = 'ship' | 'mechanic' | 'misc';

export interface BalanceChange {
  id: string;
  category: ChangeCategory;
  targetName: string;
  nation: string;
  tier: string;
  type: string;
  attribute: string;
  oldValue: string;
  newValue: string;
  version: string;
  notes: string;
  trend?: 'buff' | 'nerf' | 'neutral' | 'adjustment';
}
