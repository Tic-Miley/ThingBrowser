import { User, Menu, Bell, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThingSearch } from "@/features/search/ThingSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGlobalStore } from "@/store/useGlobalStore";

export function TopNavbar() {
  const showSidebar = useGlobalStore((s) => s.showSidebar);
  const setShowSidebar = useGlobalStore((s) => s.setShowSidebar);
  const showMap = useGlobalStore((s) => s.showMap);
  const setShowMap = useGlobalStore((s) => s.setShowMap);
  const showDetails = useGlobalStore((s) => s.showDetails);
  const setShowDetails = useGlobalStore((s) => s.setShowDetails);
  const detailsPosition = useGlobalStore((s) => s.detailsPosition);
  const setDetailsPosition = useGlobalStore((s) => s.setDetailsPosition);

  return (
    <header className="sticky top-0 z-50 flex h-11 w-full items-center justify-between border-b border-border bg-background px-3 shadow-sm select-none">
      <div className="flex items-center">
        {/* 侧边菜单切换按钮（移动端保留，桌面端可选） */}
        <Button variant="ghost" size="icon" className="h-7 w-7 mr-1 md:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">切换菜单</span>
        </Button>

        {/* 品牌标识位 */}
        <div className="flex items-center gap-2.5 mr-4 font-semibold">
          <img src="/favicon.svg" alt="物浏览器 Logo" className="h-6 w-6 text-primary" />
          {/* 大于 1024px 时显示标题，较小屏幕最先被隐藏 */}
          <span className="hidden lg:inline-block text-base tracking-wide shrink-0">物浏览器</span>
        </div>

        {/* 菜单栏 */}
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                视图
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuCheckboxItem checked={showSidebar} onCheckedChange={setShowSidebar}>
                物节点树 (侧边栏)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showMap} onCheckedChange={setShowMap}>
                地图视图面板
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showDetails} onCheckedChange={setShowDetails}>
                详情信息面板
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                详情面板位置
              </div>
              <DropdownMenuRadioGroup
                value={detailsPosition}
                onValueChange={(val) => setDetailsPosition(val as "bottom" | "right")}
              >
                <DropdownMenuRadioItem value="bottom">悬停于下方</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="right">停靠于右侧</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                帮助
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>使用文档</DropdownMenuItem>
              <DropdownMenuItem>系统快捷键</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>关于项目</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 绝对居中：瘦长型搜素框 (桌面端显示并承载Dialog逻辑) */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block pointer-events-auto">
        <ThingSearch />
      </div>

      {/* 顶部右侧用户状态与通知入口 */}
      <div className="flex items-center gap-1.5">
        {/* 移动端显示的搜索图标 (只做触发UI，不带Dialog逻辑以防重复) */}
        <div className="sm:hidden w-10 overflow-hidden">
          <ThingSearch hideDialog />
        </div>

        {/* 中等及以上屏幕：直接展现按钮 */}
        <div className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">通知</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">用户账户</span>
          </Button>
        </div>

        {/* 较小屏幕：收起到“...” */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Bell className="h-4 w-4 mr-2" />
                <span>通知</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                <span>用户账户</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
