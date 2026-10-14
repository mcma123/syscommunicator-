import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/payments')({
 head: () => ({ meta: [{title: `Payments | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} payments: your school community, connected.`}, {property: 'og:title', content: `Payments | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} payments for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="payments" />,
});
