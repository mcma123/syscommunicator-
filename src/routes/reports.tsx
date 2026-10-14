import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/reports')({
 head: () => ({ meta: [{title: 'Reports | School Connect'}, {name: 'description', content: 'School Connect reports: your school community, connected.'}, {property: 'og:title', content: 'Reports | School Connect'}, {property: 'og:description', content: 'School Connect reports for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="reports" />,
});
