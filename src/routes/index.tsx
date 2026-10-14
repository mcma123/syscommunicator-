import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/')({
 head: () => ({ meta: [{title: `Parent home | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} parent home: your school community, connected.`}, {property: 'og:title', content: `Parent home | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} parent home for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="home" />,
});
