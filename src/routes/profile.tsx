import { createFileRoute } from '@tanstack/react-router';
import { SchoolPortal } from '@/features/school/portal';
export const Route = createFileRoute('/profile')({
 head: () => ({ meta: [{title: 'Profile | School Connect'}, {name: 'description', content: 'School Connect profile: your school community, connected.'}, {property: 'og:title', content: 'Profile | School Connect'}, {property: 'og:description', content: 'School Connect profile for parents and staff.'}, {property: 'og:type', content: 'website'}, {name: 'twitter:card', content: 'summary_large_image'}] }),
 component: () => <SchoolPortal module="profile" />,
});
