import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/audit')({
 head: () => ({ meta: [{title: 'Audit | School Connect'}, {name: 'description', content: 'School Connect audit: your school community, connected.'}, {property: 'og:title', content: 'Audit | School Connect'}, {property: 'og:description', content: 'School Connect audit for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="audit" />,
});
