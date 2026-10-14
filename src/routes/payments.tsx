import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/payments')({
 head: () => ({ meta: [{title: 'Payments | School Connect'}, {name: 'description', content: 'School Connect payments: your school community, connected.'}, {property: 'og:title', content: 'Payments | School Connect'}, {property: 'og:description', content: 'School Connect payments for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="payments" />,
});
