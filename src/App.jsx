import { lazy, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider } from '@/state/store.jsx'
import { AppShell } from '@/components/app/AppShell.jsx'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Home from '@/pages/Home.jsx'
import { ScrollToTop } from '@/components/app/ScrollToTop.jsx'

// Screens are split into separate chunks. They are prefetched once the browser is idle so that,
// on the hosted site, navigating never waits on the network after the first page has loaded.
const pageLoaders = {
  Lectures: () => import('@/pages/Lectures.jsx'),
  NewLecture: () => import('@/pages/NewLecture.jsx'),
  LectureDetail: () => import('@/pages/LectureDetail.jsx'),
  Reviews: () => import('@/pages/Reviews.jsx'),
  ReviewWorkspace: () => import('@/pages/review/ReviewWorkspace.jsx'),
  Prompts: () => import('@/pages/Prompts.jsx'),
  PromptDetail: () => import('@/pages/PromptDetail.jsx'),
  Skills: () => import('@/pages/Skills.jsx'),
  Notifications: () => import('@/pages/Notifications.jsx'),
  Settings: () => import('@/pages/Settings.jsx'),
  NotFound: () => import('@/pages/NotFound.jsx'),
}
const Lectures = lazy(pageLoaders.Lectures)
const NewLecture = lazy(pageLoaders.NewLecture)
const LectureDetail = lazy(pageLoaders.LectureDetail)
const Reviews = lazy(pageLoaders.Reviews)
const ReviewWorkspace = lazy(pageLoaders.ReviewWorkspace)
const Prompts = lazy(pageLoaders.Prompts)
const PromptDetail = lazy(pageLoaders.PromptDetail)
const Skills = lazy(pageLoaders.Skills)
const Notifications = lazy(pageLoaders.Notifications)
const Settings = lazy(pageLoaders.Settings)
const NotFound = lazy(pageLoaders.NotFound)

function usePrefetchPages() {
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200))
    const id = idle(() => Object.values(pageLoaders).forEach((load) => load().catch(() => {})))
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id))
  }, [])
}

function Providers({ children }) {
  const navigate = useNavigate()
  usePrefetchPages()
  return (
    <StoreProvider onNavigate={navigate}>
      <TooltipProvider delay={300}>
        {children}
        <Toaster position="top-right" closeButton visibleToasts={4} offset={{ top: 72 }} />
      </TooltipProvider>
    </StoreProvider>
  )
}

// Router basename follows Vite's base ('' locally, '/lecture-studio' on GitHub Pages).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      <Providers>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="lectures" element={<Lectures />} />
              <Route path="lectures/new" element={<NewLecture />} />
              <Route path="lectures/:id" element={<LectureDetail />} />
              <Route path="lectures/:id/review/:gate" element={<ReviewWorkspace />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="prompts" element={<Prompts />} />
              <Route path="prompts/:id" element={<PromptDetail />} />
              <Route path="skills" element={<Skills />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
      </Providers>
    </BrowserRouter>
  )
}
