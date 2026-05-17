import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { MainLayout } from "./layouts/MainLayout"
import { Home } from "./pages/Home"

function App() {
  return (
    <BrowserRouter>
      {/* 全局路由定义层 */}
      <Routes>
        {/* 将所有基于仪表盘的页面包裹在 MainLayout 内部，共享侧边栏和顶栏 */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          {/* 其他子路由可以在此扩展，例如: */}
          {/* <Route path="things/:urn" element={<ThingDetail />} /> */}
        </Route>
        
        {/* 对于不存在的路由重定向到首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App