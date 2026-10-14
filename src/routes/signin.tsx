import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/signin')({
 head: () => ({ meta: [{title: 'School invitation | School Connect'}, {name: 'description', content: 'School Connect school invitation: your school community, connected.'}, {property: 'og:title', content: 'School invitation | School Connect'}, {property: 'og:description', content: 'School Connect school invitation for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="signin" />,
});
