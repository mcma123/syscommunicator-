import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/')({
 head: () => ({ meta: [{title: 'Parent home | School Connect'}, {name: 'description', content: 'School Connect parent home: your school community, connected.'}, {property: 'og:title', content: 'Parent home | School Connect'}, {property: 'og:description', content: 'School Connect parent home for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="home" />,
});
