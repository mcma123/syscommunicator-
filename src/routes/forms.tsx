import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/forms')({
 head: () => ({ meta: [{title: `Forms | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} forms: your school community, connected.`}, {property: 'og:title', content: `Forms | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} forms for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="forms" />,
});
