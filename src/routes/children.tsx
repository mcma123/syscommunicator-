import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/children')({
 head: () => ({ meta: [{title: `My children | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} my children: your school community, connected.`}, {property: 'og:title', content: `My children | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} my children for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="children" />,
});
