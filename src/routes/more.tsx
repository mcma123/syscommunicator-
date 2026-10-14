import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/more')({
 head: () => ({ meta: [{title: `More | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} more: your school community, connected.`}, {property: 'og:title', content: `More | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} more for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="more" />,
});
