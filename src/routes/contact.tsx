import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/contact')({
 head: () => ({ meta: [{title: 'Contact | School Connect'}, {name: 'description', content: 'School Connect contact: your school community, connected.'}, {property: 'og:title', content: 'Contact | School Connect'}, {property: 'og:description', content: 'School Connect contact for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="contact" />,
});
