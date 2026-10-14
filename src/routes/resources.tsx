import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/resources')({
 head: () => ({ meta: [{title: `Resources | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} resources: your school community, connected.`}, {property: 'og:title', content: `Resources | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} resources for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="resources" />,
});
