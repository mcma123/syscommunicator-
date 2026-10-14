import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/people')({
 head: () => ({ meta: [{title: `People | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} people: your school community, connected.`}, {property: 'og:title', content: `People | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} people for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="people" />,
});
