/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx
 * PURPOSE: Static column header row for Architect Free Agent pool table.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import React from 'react';

export const FreeAgentPoolHeader = () => (
  <div className="mb-1 shrink-0">
    <div className="mr-2 flex h-5 items-center text-[11px] font-semibold text-cockpit-text-muted">
      <div className="w-[45px] text-center">POS</div>
      <div className="w-[50px] text-center ml-1">TEAM</div>
      <div className="w-[50px]" />
      <div className="flex items-center ml-3 flex-1 justify-between mr-2">
        <span>PLAYER</span>
        <span className="pr-1">RIGHTS</span>
      </div>
      <div className="flex items-center justify-end w-[290px] mr-3 whitespace-nowrap">
        <span className="w-[44px] text-center">FA</span>
        <div className="ml-6 flex items-center gap-[8px]">
          <span className="w-[32px] text-right">HT</span>
          <span className="text-white/30">|</span>
          <span className="w-[56px] text-left">WT</span>
        </div>
        <span className="ml-10 w-[78px] text-right">PREV SAL</span>
      </div>
      <div className="w-[20px]" />
    </div>
  </div>
);
