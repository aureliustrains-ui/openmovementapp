import { useCallback, useEffect, useRef } from "react";

type UseChatAutoScrollOptions = {
  enabled?: boolean;
  stickThresholdPx?: number;
};

export function useChatAutoScroll(
  messageKey: string,
  { enabled = true, stickThresholdPx = 120 }: UseChatAutoScrollOptions = {},
) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const initializedRef = useRef(false);

  const isNearBottom = useCallback(
    (el: HTMLDivElement) => {
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      return distanceToBottom <= stickThresholdPx;
    },
    [stickThresholdPx],
  );

  const updateNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    nearBottomRef.current = isNearBottom(el);
  }, [isNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    updateNearBottom();
  }, [updateNearBottom]);

  useEffect(() => {
    if (!enabled || !messageKey) return;
    const shouldScroll = !initializedRef.current || nearBottomRef.current;
    const behavior: ScrollBehavior = initializedRef.current ? "smooth" : "auto";
    const raf = requestAnimationFrame(() => {
      if (shouldScroll) {
        scrollToBottom(behavior);
      }
      updateNearBottom();
      initializedRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [enabled, messageKey, scrollToBottom, updateNearBottom]);

  return {
    scrollContainerRef,
    handleScroll,
  };
}
