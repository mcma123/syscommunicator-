import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/people')({
 head: () => ({ meta: [{title: 'People | School Connect'}, {name: 'description', content: 'School Connect people: your school community, connected.'}, {property: 'og:title', content: 'People | School Connect'}, {property: 'og:description', content: 'School Connect people for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="people" />,
});
