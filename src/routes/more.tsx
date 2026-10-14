import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/more')({
 head: () => ({ meta: [{title: 'More | School Connect'}, {name: 'description', content: 'School Connect more: your school community, connected.'}, {property: 'og:title', content: 'More | School Connect'}, {property: 'og:description', content: 'School Connect more for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="more" />,
});
