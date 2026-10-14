import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/calendar')({
 head: () => ({ meta: [{title: 'Calendar | School Connect'}, {name: 'description', content: 'School Connect calendar: your school community, connected.'}, {property: 'og:title', content: 'Calendar | School Connect'}, {property: 'og:description', content: 'School Connect calendar for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="calendar" />,
});
