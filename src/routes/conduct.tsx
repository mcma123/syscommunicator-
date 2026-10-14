import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/conduct')({
 head: () => ({ meta: [{title: 'Conduct | School Connect'}, {name: 'description', content: 'School Connect conduct: your school community, connected.'}, {property: 'og:title', content: 'Conduct | School Connect'}, {property: 'og:description', content: 'School Connect conduct for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="conduct" />,
});
