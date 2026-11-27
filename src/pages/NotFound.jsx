import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/app/common.jsx'

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="This page doesn’t exist"
      description="The link may be outdated. Your lectures and reviews are safe."
      action={<Button render={<Link to="/" />} nativeButton={false}>Go to Home</Button>}
    />
  )
}
