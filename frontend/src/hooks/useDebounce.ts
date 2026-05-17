import { useState, useEffect } from "react";

/**
 * 防抖 Hook：用于限制高频触发的值更新（如搜索栏输入）
 * @param value 需要防抖的值
 * @param delay 延迟毫秒数
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
