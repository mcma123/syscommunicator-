import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/settings')({
 head: () => ({ meta: [{title: 'Settings | School Connect'}, {name: 'description', content: 'School Connect settings: your school community, connected.'}, {property: 'og:title', content: 'Settings | School Connect'}, {property: 'og:description', content: 'School Connect settings for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="settings" />,
});
