import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createMockRepository, type Role, type SchoolState, type SchoolRepository } from '../../../packages/school-core/src';
import { toast } from 'sonner';
interface AppStore { state: SchoolState; update: SchoolRepository['update']; role: Role; setRole: (role: Role) => void; child: string; setChild: (child: string) => void; offline: boolean; setOffline: (offline: boolean) => void; notify: (message: string) => void }
const Context = createContext<AppStore | null>(null);
export function SchoolProvider({children}:{children:ReactNode}) {
 const [repository] = useState(createMockRepository); const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot,repository.getSnapshot);
 const [role,setRole] = useState<Role>('Parent'); const [child,setChild] = useState('all'); const [offline,setOffline] = useState(false);
 const update: SchoolRepository['update'] = fn => { if (offline) { toast.error('You’re offline. Reconnect before saving changes.'); return; } repository.update(fn); };
 return <Context.Provider value={{state,update,role,setRole,child,setChild,offline,setOffline,notify:toast.success}}>{children}</Context.Provider>;
}
export function useSchool() {const store=useContext(Context);if(!store)throw new Error('SchoolProvider is required');return store;}
