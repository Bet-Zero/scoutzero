import type { JSX } from 'react';

type PlayerNameMiniProps = {
  name?: string;
  scale?: number;
  width?: number;
  firstWeightClass?: string;
  lastWeightClass?: string;
};

declare const PlayerNameMini: (props: PlayerNameMiniProps) => JSX.Element;

