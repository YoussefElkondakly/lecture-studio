import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider } from '@/state/store.jsx'
import { AppShell } from '@/components/app/AppShell.jsx'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import Home from '@/pages/Home.jsx'
import { ScrollToTop } from '@/components/app/ScrollToTop.jsx'

const Lectures = lazy(() => import('@/pages/Lectures.jsx'))
const NewLecture = lazy(() => import('@/pages/NewLecture.jsx'))
const LectureDetail = lazy(() => import('@/pages/LectureDetail.jsx'))
const Reviews = lazy(() => import('@/pages/Reviews.jsx'))
const ReviewWorkspace = lazy(() => import('@/pages/review/ReviewWorkspace.jsx'))
const Prompts = lazy(() => import('@/pages/Prompts.jsx'))
const PromptDetail = lazy(() => import('@/pages/PromptDetail.jsx'))
const Skills = lazy(() => import('@/pages/Skills.jsx'))
const Notifications = lazy(() => import('@/pages/Notifications.jsx'))
const Settings = lazy(() => import('@/pages/Settings.jsx'))
const NotFound = lazy(() => import('@/pages/NotFound.jsx'))

function PageFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function Providers({ children }) {
  const navigate = useNavigate()
  return (
    <StoreProvider onNavigate={navigate}>
      <TooltipProvider delay={300}>
        {children}
        <Toaster position="top-right" closeButton visibleToasts={4} offset={{ top: 72 }} />
      </TooltipProvider>
    </StoreProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Providers>
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
      </Providers>
    </BrowserRouter>
  )
}
