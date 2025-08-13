/**
 * Common interfaces for trade validation
 */

export interface CapSettings {
  salaryCap: number;
  luxuryTax: number;
  firstApron: number;
  secondApron: number;
}

export interface ValidationResult {
  passed: boolean;
  violations: string[];
  message: string;
  details?: string;
}

export interface TeamContext {
  capSettings: {
    salaryCap?: number;
    firstApron?: number;
    secondApron?: number;
    taxLine?: number;
  };
  yearKey: number;
  tradeDate?: string;
}

export interface TradeTeam {
  teamId?: string;
  teamName?: string;
  bucketType?: string;
  salaryOut: number;
  salaryIn: number;
  teamTotalSalary?: number;
  projectedSalary?: number;
  hardCapped?: boolean;
  hardCapTrigger?: string | null;
  absorptionMode?: string;
  incomingPlayers?: any[];
  outgoingPlayers?: any[];
  team?: {
    hardCapTriggered?: boolean | 'FirstApron' | 'SecondApron';
    twoWayPlayers?: any[];
  };
  context?: {
    yearKey: number | string;
    capSettings?: {
      salaryCap?: number;
      firstApron?: number;
      secondApron?: number;
      taxLine?: number;
    };
  };
  capSettings?: CapSettings;
}

export interface RosterCounts {
  standard: number;
  twoWay: number;
  projected: number;
  current: number;
  incomingTwoWay: number;
  outgoingTwoWay: number;
}

export interface SalaryMatchingResult extends ValidationResult {
  allowable?: number;
  salaryIn: number;
  salaryOut: number;
  difference: number;
  ceiling?: number;
}

export interface RosterResult extends ValidationResult {
  rosterCounts?: {
    standard: number;
    twoWay: number;
  };
}

export interface HardCapResult extends ValidationResult {
  projectedSalary: number;
  hardCapType?: 'FirstApron' | 'SecondApron' | null;
  trigger: string | null;
}

export interface StepienResult extends ValidationResult {
  calendar?: any[];
  farthestYear: number;
  currentYear: number;
}
