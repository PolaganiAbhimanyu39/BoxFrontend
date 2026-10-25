import { router } from 'expo-router';
import ManageRecords from '@/features/management/components/manage-records';

export default function UsersScreen() {
  return <ManageRecords kind="users" onClose={() => router.back()} onChanged={() => {}} onBusyChange={() => {}} />;
}
