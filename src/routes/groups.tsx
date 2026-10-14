import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/groups')({
 head: () => ({ meta: [{title: 'Groups | School Connect'}, {name: 'description', content: 'School Connect groups: your school community, connected.'}, {property: 'og:title', content: 'Groups | School Connect'}, {property: 'og:description', content: 'School Connect groups for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="groups" />,
});
