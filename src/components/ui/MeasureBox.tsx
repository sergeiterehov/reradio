import { type BoxProps, Box } from "@chakra-ui/react";
import { useRef, useState, useLayoutEffect } from "react";

export function MeasureBox(
  props: Omit<BoxProps, "children"> & {
    children: (size: { width: number; height: number }, element: HTMLDivElement) => React.ReactNode;
  }
) {
  const { children, ...boxProps } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>();

  useLayoutEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ width: cr.width, height: cr.height });
      }
    });

    observer.observe(ref.current);
    setSize({ width: ref.current.offsetWidth, height: ref.current.offsetHeight });

    return () => observer.disconnect();
  }, []);

  return (
    <Box {...boxProps} ref={ref}>
      {size && children(size, ref.current!)}
    </Box>
  );
}
