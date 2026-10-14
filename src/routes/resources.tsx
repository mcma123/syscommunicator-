import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/resources')({
 head: () => ({ meta: [{title: 'Resources | School Connect'}, {name: 'description', content: 'School Connect resources: your school community, connected.'}, {property: 'og:title', content: 'Resources | School Connect'}, {property: 'og:description', content: 'School Connect resources for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="resources" />,
});
