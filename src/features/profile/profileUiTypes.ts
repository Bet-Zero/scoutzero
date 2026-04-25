import type React from 'react';
import type { UsePlayerProfileStateResult } from './hooks/usePlayerProfileState';

export type ProfilePlayer = NonNullable<UsePlayerProfileStateResult['player']>;
export type OpenProfileModal = React.Dispatch<React.SetStateAction<string | null>>;
export type ProfileSetter<T> = React.Dispatch<React.SetStateAction<T>>;
