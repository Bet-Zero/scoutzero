declare module 'lodash.debounce' {
  type DebouncedFunction<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
    cancel: () => void;
    flush: () => void;
  };

  type DebounceSettings = {
    leading?: boolean;
    maxWait?: number;
    trailing?: boolean;
  };

  function debounce<TArgs extends unknown[]>(
    func: (...args: TArgs) => void,
    wait?: number,
    options?: DebounceSettings
  ): DebouncedFunction<TArgs>;

  export = debounce;
}

declare module 'react-window' {
  import type { Component, ComponentType, CSSProperties, HTMLAttributes } from 'react';

  export type ListChildComponentProps<TData = unknown> = {
    data: TData;
    index: number;
    isScrolling?: boolean;
    style: CSSProperties;
  };

  export type FixedSizeListProps<TData = unknown> = {
    children: ComponentType<ListChildComponentProps<TData>>;
    className?: string;
    height: number;
    innerElementType?: ComponentType<HTMLAttributes<HTMLDivElement>>;
    itemCount: number;
    itemData?: TData;
    itemSize: number;
    onScroll?: (props: { scrollOffset: number }) => void;
    width: number;
  };

  export class FixedSizeList<TData = unknown> extends Component<
    FixedSizeListProps<TData>
  > {
    scrollTo(scrollOffset: number): void;
    scrollToItem(
      index: number,
      align?: 'auto' | 'smart' | 'center' | 'end' | 'start'
    ): void;
  }
}
