import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/reports')({
 head: () => ({ meta: [{title: `Reports | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} reports: your school community, connected.`}, {property: 'og:title', content: `Reports | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} reports for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="reports" />,
});
