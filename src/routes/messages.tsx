import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/messages')({
 head: () => ({ meta: [{title: 'Messages | School Connect'}, {name: 'description', content: 'School Connect messages: your school community, connected.'}, {property: 'og:title', content: 'Messages | School Connect'}, {property: 'og:description', content: 'School Connect messages for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="messages" />,
});
