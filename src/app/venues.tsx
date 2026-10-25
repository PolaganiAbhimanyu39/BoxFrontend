import { router } from 'expo-router';
import ManageRecords from '@/features/management/components/manage-records';

export default function VenuesScreen() {
  return <ManageRecords kind="venues" onClose={() => router.back()} onChanged={() => {}} onBusyChange={() => {}} />;
}
