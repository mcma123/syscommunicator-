import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/contact')({
 head: () => ({ meta: [{title: `Contact | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} contact: your school community, connected.`}, {property: 'og:title', content: `Contact | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} contact for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="contact" />,
});
