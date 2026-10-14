import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/calendar')({
 head: () => ({ meta: [{title: `Calendar | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} calendar: your school community, connected.`}, {property: 'og:title', content: `Calendar | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} calendar for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="calendar" />,
});
