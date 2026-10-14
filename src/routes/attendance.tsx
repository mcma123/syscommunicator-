import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/attendance')({
 head: () => ({ meta: [{title: 'Attendance | School Connect'}, {name: 'description', content: 'School Connect attendance: your school community, connected.'}, {property: 'og:title', content: 'Attendance | School Connect'}, {property: 'og:description', content: 'School Connect attendance for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="attendance" />,
});
