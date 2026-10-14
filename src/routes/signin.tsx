import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/signin')({
 head: () => ({ meta: [{title: `School invitation | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} school invitation: your school community, connected.`}, {property: 'og:title', content: `School invitation | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} school invitation for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="signin" />,
});
