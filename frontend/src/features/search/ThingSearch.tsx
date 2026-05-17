import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useGlobalStore } from "@/store/useGlobalStore"
import { useDebounce } from "@/hooks/useDebounce"
import { searchThings, type SearchItem } from "@/services/http/searchService"
import { createLogger } from "@/services/logger"

const log = createLogger("Search");

export function ThingSearch({ hideDialog = false }: { hideDialog?: boolean }) {
  const open = useGlobalStore(s => s.searchOpen)
  const setOpen = useGlobalStore(s => s.setSearchOpen)
  const toggleOpen = useGlobalStore(s => s.toggleSearchOpen)

  const [searchItems, setSearchItems] = useState<SearchItem[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const setActiveThingUrn = useGlobalStore(s => s.setActiveThingUrn)

  const debouncedSearchTerm = useDebounce(inputValue, 400)

  // 监听搜索词变化，发起防抖后端检索
  useEffect(() => {
    const trimmed = debouncedSearchTerm.trim();

    // 没输入内容时不请求
    if (!trimmed) {
      setSearchItems([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    searchThings(debouncedSearchTerm)
      .then((items) => {
        if (!cancelled) setSearchItems(items);
      })
      .catch((err) => {
        if (!cancelled) {
          log.error("拉取全局搜索候选项失败:", err);
          setErrorMessage("搜索失败，请稍后重试。");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm])

  // 快捷键绑定 (Ctrl+K or Cmd+K)
  useEffect(() => {
    // 若开启了隐藏 Dialog 的模式，则该组件不负责监听事件，避免双重绑定
    if (hideDialog) return

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleOpen()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [hideDialog, toggleOpen])

  const handleSelect = (item: SearchItem) => {
    setOpen(false);
    if (item.urn) {
      setActiveThingUrn(item.urn);
    }
  };

  function getEmptyMessage(
    error: string | null,
    loading: boolean,
    hasQuery: boolean
  ): string {
    if (error) return error;
    if (loading) return "加载中...";
    if (hasQuery) return "未找到相关结果。";
    return "输入关键词开始搜索。";
  }

  const emptyMessage = getEmptyMessage(
    errorMessage,
    isLoading,
    !!debouncedSearchTerm.trim()
  );

  return (
    <>
      <div 
        className="relative w-full cursor-text group"
        onClick={() => setOpen(true)}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <div className="flex h-8 w-[40vw] sm:w-[35vw] md:w-[30vw] min-w-50 max-w-120 items-center justify-between rounded-full border border-input bg-muted/40 px-3 py-1 text-sm text-muted-foreground shadow-sm group-hover:bg-accent transition-colors pl-9">
          <span className="truncate">搜索地址或设备...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {!hideDialog && (
        <CommandDialog open={open} onOpenChange={setOpen} className="top-1/2 -translate-y-1/2 max-w-150 w-[90vw] md:max-w-175">
          <Command shouldFilter={false}>
            <CommandInput 
              className="text-base h-12" 
              placeholder="输入你想找的设备或地址 (支持模糊搜索如: 贵阳火车站)..." 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList className="max-h-112.5">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup heading="设备与物节点">
                {/* TODO: 结果 > 50 条时可引入虚拟滚动（如 @tanstack/react-virtual） */}
                {searchItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="flex flex-col items-start gap-1 py-2"
                  >
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-xs text-muted-foreground/80 line-clamp-1">{item.path}</div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialog>
      )}
    </>
  )
}
