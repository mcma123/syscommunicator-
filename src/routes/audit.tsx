import { schoolConfig } from '../../packages/school-core/src';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/audit')({
 head: () => ({ meta: [{title: `Audit | ${schoolConfig.name}`}, {name: 'description', content: `${schoolConfig.name} audit: your school community, connected.`}, {property: 'og:title', content: `Audit | ${schoolConfig.name}`}, {property: 'og:description', content: `${schoolConfig.name} audit for parents and staff.`}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="audit" />,
});
