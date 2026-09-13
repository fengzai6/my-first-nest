import { useEffect, useRef, useState } from "react";

export const useElementHeight = () => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return { elementRef, height };
};
